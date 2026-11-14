-- Súper: catálogo con precios de Mercadona e HiperDino (Tenerife), histórico de
-- cambios, cola del rastreo nocturno y lista de la compra compartida por hogar.

create extension if not exists pg_trgm with schema extensions;

-- Normaliza para buscar sin tildes ni mayúsculas.
create function public.normaliza(t text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(translate(coalesce(t, ''), 'áéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ', 'aeiouunaeiouaeiouunaeiou'))
$$;

-- 1. Catálogo (común a todos; solo lo escribe el rastreo con service role)
create table public.productos (
  id              uuid primary key default gen_random_uuid(),
  super           text not null check (super in ('mercadona', 'hiperdino')),
  ext_id          text not null,
  nombre          text not null,
  nombre_norm     text generated always as (public.normaliza(nombre)) stored,
  formato         text,
  categoria       text,
  imagen          text,
  url             text,
  precio          numeric(10, 2) not null,
  precio_unidad   numeric(10, 2),
  unidad          text,               -- 'kg', 'l', 'ud'
  precio_antes    numeric(10, 2),     -- solo si está rebajado
  visto_at        timestamptz not null default now(),
  cambiado_at     timestamptz not null default now(),
  activo          boolean not null default true,
  unique (super, ext_id)
);
create index productos_nombre_trgm on public.productos using gin (nombre_norm extensions.gin_trgm_ops);

create table public.precios (
  producto_id   uuid not null references public.productos (id) on delete cascade,
  desde         timestamptz not null default now(),
  precio        numeric(10, 2) not null,
  precio_unidad numeric(10, 2),
  primary key (producto_id, desde)
);

alter table public.productos enable row level security;
alter table public.precios enable row level security;
revoke all on public.productos, public.precios from anon;
create policy productos_leer on public.productos for select to authenticated using (true);
create policy precios_leer on public.precios for select to authenticated using (true);
revoke insert, update, delete on public.productos, public.precios from authenticated;

-- 2. Cola del rastreo nocturno (solo service role)
create table public.precios_cola (
  id        bigserial primary key,
  noche     date not null,
  super     text not null,
  ref       text not null,
  pagina    integer not null default 1,
  estado    text not null default 'pendiente' check (estado in ('pendiente', 'hecho', 'error')),
  intentos  integer not null default 0,
  error     text,
  hecho_at  timestamptz,
  unique (noche, super, ref, pagina)
);
revoke all on public.precios_cola from anon, authenticated;
alter table public.precios_cola enable row level security;

-- Guarda un lote de productos: alta o actualización y una fila de histórico solo si cambió el precio.
create function public.guardar_precios(p_super text, p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cambios integer;
begin
  with entrada as (
    select distinct on (x.ext_id) x.*
    from jsonb_to_recordset(p_items) as x(
      ext_id text, nombre text, formato text, categoria text, imagen text, url text,
      precio numeric, precio_unidad numeric, unidad text, precio_antes numeric)
    where x.ext_id is not null and x.nombre is not null and x.precio is not null and x.precio > 0
  ),
  previos as (
    select p.id, p.ext_id, p.precio from public.productos p
    where p.super = p_super and p.ext_id in (select ext_id from entrada)
  ),
  guardados as (
    insert into public.productos as p (super, ext_id, nombre, formato, categoria, imagen, url, precio, precio_unidad, unidad, precio_antes)
    select p_super, e.ext_id, e.nombre, e.formato, e.categoria, e.imagen, e.url, e.precio, e.precio_unidad, e.unidad, e.precio_antes
    from entrada e
    on conflict (super, ext_id) do update set
      nombre = excluded.nombre,
      formato = excluded.formato,
      categoria = coalesce(excluded.categoria, p.categoria),
      imagen = excluded.imagen,
      url = excluded.url,
      precio = excluded.precio,
      precio_unidad = excluded.precio_unidad,
      unidad = excluded.unidad,
      precio_antes = excluded.precio_antes,
      visto_at = now(),
      activo = true,
      cambiado_at = case when p.precio is distinct from excluded.precio then now() else p.cambiado_at end
    returning p.id, p.ext_id, p.precio, p.precio_unidad
  )
  insert into public.precios (producto_id, precio, precio_unidad)
  select g.id, g.precio, g.precio_unidad
  from guardados g left join previos v on v.ext_id = g.ext_id
  where v.id is null or v.precio is distinct from g.precio;
  get diagnostics v_cambios = row_count;
  return v_cambios;
end;
$$;
revoke execute on function public.guardar_precios(text, jsonb) from public, anon, authenticated;
grant execute on function public.guardar_precios(text, jsonb) to service_role;

-- Búsqueda para la app: todas las palabras deben aparecer; ordena por parecido.
create function public.buscar_productos(q text, p_super text default null)
returns setof public.productos
language sql
stable
set search_path = ''
as $$
  with t as (
    select public.normaliza(trim(q)) as q,
           array_remove(regexp_split_to_array(public.normaliza(trim(q)), '\s+'), '') as palabras
  )
  select p.*
  from public.productos p, t
  where p.activo
    and (p_super is null or p.super = p_super)
    and char_length(t.q) >= 2
    and not exists (select 1 from unnest(t.palabras) w where p.nombre_norm not like '%' || w || '%')
  order by extensions.word_similarity(t.q, p.nombre_norm) desc, p.precio_unidad nulls last, p.precio
  limit 40
$$;
revoke execute on function public.buscar_productos(text, text) from public, anon;
grant execute on function public.buscar_productos(text, text) to authenticated, service_role;

-- Lo más parecido en el otro súper (para comparar y repartir la lista).
create function public.equivalentes(p_producto uuid)
returns table (id uuid, super text, nombre text, formato text, precio numeric, precio_unidad numeric, unidad text, parecido real)
language sql
stable
set search_path = ''
as $$
  with o as (select * from public.productos where id = p_producto),
  limpio as (
    -- Quita la marca blanca de cada súper para comparar el resto del nombre.
    select o.*, trim(regexp_replace(o.nombre_norm, '\m(hacendado|bosque verde|deliplus|compy|hiperdino|dia|happyday)\M', '', 'g')) as base
    from o
  )
  select p.id, p.super, p.nombre, p.formato, p.precio, p.precio_unidad, p.unidad,
         extensions.similarity(l.base, p.nombre_norm) + case when p.unidad = l.unidad then 0.1 else 0 end as parecido
  from public.productos p, limpio l
  where p.super <> l.super and p.activo
    and extensions.similarity(l.base, p.nombre_norm) > 0.2
  order by parecido desc
  limit 6
$$;
revoke execute on function public.equivalentes(uuid) from public, anon;
grant execute on function public.equivalentes(uuid) to authenticated, service_role;

-- 3. Lista de la compra del hogar
create table public.lista_items (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null default public.my_household() references public.households (id) on delete cascade,
  texto          text not null check (char_length(texto) between 1 and 120),
  cantidad       smallint not null default 1 check (cantidad between 1 and 99),
  producto_id    uuid references public.productos (id) on delete set null,
  alternativa_id uuid references public.productos (id) on delete set null,
  super_fijo     text check (super_fijo in ('mercadona', 'hiperdino')),
  comprado_at    timestamptz,
  comprado_por   uuid references auth.users (id) on delete set null,
  creado_por     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index lista_items_household_idx on public.lista_items (household_id, created_at);

alter table public.lista_items enable row level security;
revoke all on public.lista_items from anon;
create policy lista_todo on public.lista_items
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

alter publication supabase_realtime add table public.lista_items;

-- 4. Rastreo nocturno: de 02:00 a 05:57 UTC cada 3 minutos (la función sale enseguida si ya terminó).
select cron.schedule(
  'casa-precios',
  '*/3 2-5 * * *',
  $$
  select net.http_post(
    url := 'https://wokoivpcjvaqnjyuqmjb.supabase.co/functions/v1/precios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'casa_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $$
);
