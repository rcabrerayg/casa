-- Inventario de casa: lo que hay (y lo que se gasta solo cada día), historial de compras para aprender
-- cada cuánto se compra cada cosa, y funciones para reponer y para pasar el menú a la lista descontando lo que hay.

-- ¿Encaja un texto con un nombre? Todas las palabras del nombre (normalizadas) están en el texto.
create function public.encaja(p_texto text, p_nombre text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select char_length(trim(coalesce(p_nombre, ''))) > 0
     and not exists (
       select 1 from unnest(regexp_split_to_array(public.normaliza(trim(p_nombre)), '\s+')) w
       where w <> '' and public.normaliza(p_texto) not like '%' || w || '%'
     )
$$;
grant execute on function public.encaja(text, text) to authenticated, service_role;

create table public.inventario (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null default public.my_household() references public.households (id) on delete cascade,
  nombre         text not null check (char_length(nombre) between 1 and 80),
  producto_id    uuid references public.productos (id) on delete set null,
  unidad         text not null default 'ud' check (char_length(unidad) between 1 and 20),
  cantidad       numeric(8, 2) not null default 0 check (cantidad >= 0),
  -- Cuántas «unidades» trae cada envase del producto (pack de 6 briks → 6).
  por_envase     numeric(8, 2) not null default 1 check (por_envase > 0),
  -- Lo que se gasta solo cada día (leche: 0,75 briks), aparte de las recetas.
  consumo_dia    numeric(8, 3) not null default 0 check (consumo_dia >= 0),
  -- Por debajo de esto, toca reponer. Con reserva = true se repone siempre.
  minimo         numeric(8, 2) not null default 0 check (minimo >= 0),
  reserva        boolean not null default false,
  lugar          text not null default 'despensa' check (lugar in ('nevera', 'congelador', 'despensa')),
  actualizado_at timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index inventario_household_idx on public.inventario (household_id);
alter table public.inventario enable row level security;
revoke all on public.inventario from anon;
create policy inventario_todo on public.inventario
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());
alter publication supabase_realtime add table public.inventario;

-- Cada cosa que se marca como comprada queda aquí (aunque luego se vacíe la lista).
create table public.compras_historial (
  id           bigint generated always as identity primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  texto        text not null,
  producto_id  uuid references public.productos (id) on delete set null,
  cantidad     smallint not null default 1,
  comprado_at  timestamptz not null default now(),
  comprado_por uuid references auth.users (id) on delete set null
);
create index compras_historial_idx on public.compras_historial (household_id, comprado_at desc);
alter table public.compras_historial enable row level security;
revoke all on public.compras_historial from anon;
create policy compras_historial_leer on public.compras_historial
  for select to authenticated using (household_id = public.my_household());

-- Lo que queda ahora: lo apuntado menos lo que se ha ido gastando solo desde entonces.
create function public.inventario_estado()
returns table (id uuid, nombre text, producto_id uuid, unidad text, cantidad numeric, efectiva numeric, por_envase numeric,
               consumo_dia numeric, minimo numeric, reserva boolean, lugar text, dias_restantes numeric, actualizado_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select i.id, i.nombre, i.producto_id, i.unidad, i.cantidad,
         round(greatest(0, i.cantidad - i.consumo_dia * extract(epoch from now() - i.actualizado_at) / 86400), 2),
         i.por_envase, i.consumo_dia, i.minimo, i.reserva, i.lugar,
         case when i.consumo_dia > 0
              then round(greatest(0, i.cantidad - i.consumo_dia * extract(epoch from now() - i.actualizado_at) / 86400) / i.consumo_dia, 1) end,
         i.actualizado_at
  from public.inventario i
  where i.household_id = public.my_household()
  order by i.lugar, i.nombre
$$;
revoke execute on function public.inventario_estado() from public, anon;
grant execute on function public.inventario_estado() to authenticated;

-- Al marcar algo como comprado: al historial, y suma al inventario si encaja con algo de casa.
-- security definer: el historial solo se puede leer desde la app, aquí se escribe en nombre del trigger.
create function public.al_comprar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.inventario;
begin
  if new.comprado_at is not null and old.comprado_at is null then
    insert into public.compras_historial (household_id, texto, producto_id, cantidad, comprado_at, comprado_por)
    values (new.household_id, new.texto, new.producto_id, new.cantidad, new.comprado_at, new.comprado_por);

    select * into inv from public.inventario i
     where i.household_id = new.household_id
       and ((new.producto_id is not null and i.producto_id = new.producto_id) or public.encaja(new.texto, i.nombre))
     order by (i.producto_id = new.producto_id) desc nulls last
     limit 1;
    if found then
      update public.inventario
         set cantidad = greatest(0, inv.cantidad - inv.consumo_dia * extract(epoch from now() - inv.actualizado_at) / 86400)
                        + new.cantidad * inv.por_envase,
             actualizado_at = now()
       where id = inv.id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.al_comprar() from public, anon, authenticated;
create trigger lista_items_al_comprar after update of comprado_at on public.lista_items
  for each row execute function public.al_comprar();

-- Lo que se compra con regularidad: cuántas veces, cada cuántos días, y si ya toca.
create function public.compras_sugeridas()
returns table (texto text, producto_id uuid, veces int, cada_dias numeric, ultima timestamptz, toca boolean)
language sql
stable
set search_path = ''
as $$
  with h as (
    select coalesce(h.producto_id::text, public.normaliza(h.texto)) as clave, h.texto, h.producto_id, h.comprado_at::date as dia
    from public.compras_historial h
    where h.household_id = public.my_household() and h.comprado_at > now() - interval '180 days'
  ),
  dias as (select distinct clave, dia from h),
  g as (
    select d.clave, count(*)::int as veces, min(d.dia) as primera, max(d.dia) as ultima from dias d group by d.clave having count(*) >= 2
  )
  select (select h.texto from h where h.clave = g.clave order by h.dia desc limit 1),
         (select h.producto_id from h where h.clave = g.clave order by h.dia desc limit 1),
         g.veces,
         round((g.ultima - g.primera)::numeric / (g.veces - 1), 1),
         g.ultima::timestamptz,
         g.ultima + ((g.ultima - g.primera)::numeric / (g.veces - 1))::int <= current_date + 2
  from g
  order by 6 desc, 4
$$;
revoke execute on function public.compras_sugeridas() from public, anon;
grant execute on function public.compras_sugeridas() to authenticated;

-- Completa la lista con lo que va a faltar en p_dias: reserva bajo mínimo o que se acaba con el consumo diario,
-- y (si p_habituales) lo que se suele comprar y ya toca. No duplica lo que ya está pendiente.
create function public.reponer(p_dias int default 7, p_habituales boolean default true)
returns table (texto text, cantidad int, motivo text)
language plpgsql
set search_path = ''
as $$
begin
  return query
  with falta as (
    select e.nombre, e.producto_id, e.unidad,
           ceil(greatest(0, e.minimo + e.consumo_dia * p_dias - e.efectiva) / e.por_envase)::int as envases,
           case when e.consumo_dia > 0 and e.efectiva < e.consumo_dia * p_dias
                then format('se acaba en %s días', coalesce(e.dias_restantes, 0))
                else 'por debajo del mínimo' end as motivo
    from public.inventario_estado() e
    where (e.reserva or e.minimo > 0 or e.consumo_dia > 0)
      and e.efectiva < e.minimo + e.consumo_dia * p_dias
  ),
  habituales as (
    select s.texto, s.producto_id, 1 as envases, format('lo compráis cada ~%s días', round(s.cada_dias)) as motivo
    from public.compras_sugeridas() s
    where p_habituales and s.toca
      and not exists (select 1 from public.inventario i where i.household_id = public.my_household()
                       and ((s.producto_id is not null and i.producto_id = s.producto_id) or public.encaja(s.texto, i.nombre)))
  ),
  todo as (
    select coalesce(p.nombre, f.nombre) as texto, f.producto_id, f.envases, f.motivo
    from falta f left join public.productos p on p.id = f.producto_id
    where f.envases > 0
    union all
    select h.texto, h.producto_id, h.envases, h.motivo from habituales h
  ),
  nuevos as (
    insert into public.lista_items (texto, cantidad, producto_id)
    select left(t.texto, 120), least(99, t.envases), t.producto_id
    from todo t
    where not exists (
      select 1 from public.lista_items l
      where l.household_id = public.my_household() and l.comprado_at is null
        and ((t.producto_id is not null and l.producto_id = t.producto_id) or public.encaja(l.texto, t.texto))
    )
    returning lista_items.texto, lista_items.cantidad::int
  )
  select n.texto, n.cantidad, (select t.motivo from todo t where left(t.texto, 120) = n.texto limit 1) from nuevos n;
end;
$$;
revoke execute on function public.reponer(int, boolean) from public, anon;
grant execute on function public.reponer(int, boolean) to authenticated;

-- Pasa la compra de un menú a la lista: quita lo que ya hay en casa (y lo descuenta del inventario,
-- porque lo van a gastar las recetas), y sustituye lo que quedara sin comprar de menús anteriores.
create function public.menu_a_lista(p_menu uuid)
returns table (anadidos int, de_casa text[])
language plpgsql
set search_path = ''
as $$
declare
  m public.menus;
  linea jsonb;
  inv record;
  quiero int;
  cubre int;
  casa text[] := '{}';
  n int := 0;
begin
  select * into m from public.menus where id = p_menu and household_id = public.my_household();
  if not found then raise exception 'No encuentro ese menú'; end if;

  delete from public.lista_items where household_id = m.household_id and menu_id is not null and comprado_at is null;

  for linea in select * from jsonb_array_elements(coalesce(m.compra, '[]')) loop
    quiero := greatest(1, least(99, coalesce((linea ->> 'unidades')::int, 1)));
    select e.* into inv from public.inventario_estado() e
     where (e.producto_id is not null and e.producto_id::text = linea -> 'producto' ->> 'id')
        or public.encaja(coalesce(linea -> 'producto' ->> 'nombre', '') || ' ' || (linea ->> 'ingrediente'), e.nombre)
     order by (e.producto_id::text = linea -> 'producto' ->> 'id') desc nulls last
     limit 1;
    if found and inv.efectiva > 0 then
      cubre := least(quiero, floor(inv.efectiva / inv.por_envase)::int);
      if cubre > 0 then
        update public.inventario set cantidad = greatest(0, inv.efectiva - cubre * inv.por_envase), actualizado_at = now()
         where id = inv.id;
        casa := casa || inv.nombre;
        quiero := quiero - cubre;
      end if;
    end if;
    if quiero > 0 then
      insert into public.lista_items (texto, cantidad, producto_id, super_fijo, menu_id)
      values (left(coalesce(linea -> 'producto' ->> 'nombre', (linea ->> 'ingrediente') || ' (' || (linea ->> 'cantidad') || ')'), 120),
              quiero,
              (linea -> 'producto' ->> 'id')::uuid,
              case when (linea ->> 'por_regla')::boolean and linea -> 'producto' ->> 'super' in ('mercadona', 'hiperdino')
                   then linea -> 'producto' ->> 'super' end,
              m.id);
      n := n + 1;
    end if;
  end loop;
  return query select n, casa;
end;
$$;
revoke execute on function public.menu_a_lista(uuid) from public, anon;
grant execute on function public.menu_a_lista(uuid) to authenticated;

-- Lo que ya se había marcado como comprado entra en el historial.
insert into public.compras_historial (household_id, texto, producto_id, cantidad, comprado_at, comprado_por)
select household_id, texto, producto_id, cantidad, comprado_at, comprado_por from public.lista_items where comprado_at is not null;
