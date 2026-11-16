-- Que el menú aprenda de cómo coméis de verdad:
-- 1. Opiniones de cada persona (votos tras comer y, más flojito, los cambios de plato).
-- 2. Antojos: lo que a alguien le apetece; el próximo menú lo incluye (los de la mamá, primero).
-- 3. Cada comida se confirma (plan.dias[i][momento].hecho). Si no se comió, se pasa al día siguiente
--    (lo que no cabe queda en plan.pendientes para el menú siguiente) o se quita y la lista se ajusta sola.
-- 4. Si sobra, las sobras ocupan los huecos siguientes y lo que había allí sale de la lista.

-- 1. Opiniones -----------------------------------------------------------------------------------
create table public.opiniones (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id      uuid default auth.uid() references auth.users (id) on delete set null,
  titulo       text not null check (char_length(titulo) between 1 and 160),
  momento      text check (momento in ('almuerzo', 'cena')),
  voto         smallint not null check (voto between -1 and 2), -- -1 no, 0 normal, 1 bien, 2 le encanta
  fuente       text not null default 'voto' check (fuente in ('voto', 'cambio')),
  created_at   timestamptz not null default now()
);
create unique index opiniones_voto_unico on public.opiniones (household_id, user_id, titulo) where fuente = 'voto';
create index opiniones_casa on public.opiniones (household_id, created_at desc);
alter table public.opiniones enable row level security;
revoke all on public.opiniones from anon, authenticated;
grant select, delete on public.opiniones to authenticated;
create policy opiniones_ver on public.opiniones for select to authenticated using (household_id = public.my_household());
create policy opiniones_borrar on public.opiniones for delete to authenticated using (household_id = public.my_household());

-- Los votos de antes (eran de la casa) pasan a ser de quien los puso.
insert into public.opiniones (household_id, user_id, titulo, momento, voto, fuente, created_at)
select household_id, creado_por, titulo, momento, voto, 'voto', updated_at from public.valoraciones
on conflict do nothing;

-- Vota (o borra el voto, con p_voto null) lo que le pareció un plato a quien llama.
create function public.opinar(p_titulo text, p_momento text, p_voto int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := left(trim(coalesce(p_titulo, '')), 160);
begin
  if public.my_household() is null or char_length(t) = 0 then raise exception 'No válido'; end if;
  if p_voto is null then
    delete from public.opiniones
     where household_id = public.my_household() and user_id = auth.uid() and titulo = t and fuente = 'voto';
    return;
  end if;
  if p_voto not between -1 and 2 then raise exception 'Voto no válido'; end if;
  insert into public.opiniones (household_id, user_id, titulo, momento, voto, fuente)
  values (public.my_household(), auth.uid(), t, case when p_momento in ('almuerzo', 'cena') then p_momento end, p_voto, 'voto')
  on conflict (household_id, user_id, titulo) where fuente = 'voto'
  do update set voto = excluded.voto, momento = coalesce(excluded.momento, public.opiniones.momento), created_at = now();
end;
$$;
revoke execute on function public.opinar(text, text, int) from public, anon;
grant execute on function public.opinar(text, text, int) to authenticated;

-- 2. Antojos -------------------------------------------------------------------------------------
create table public.antojos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  user_id      uuid default auth.uid() references auth.users (id) on delete set null,
  texto        text not null check (char_length(trim(texto)) between 2 and 120),
  usado_en     uuid references public.menus (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index antojos_casa on public.antojos (household_id, created_at desc);
alter table public.antojos enable row level security;
revoke all on public.antojos from anon;
create policy antojos_todo on public.antojos for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

-- 3. Avisos de «¿comisteis…?» ----------------------------------------------------------------------
alter table public.members add column if not exists aviso_comidas boolean not null default true;
alter table public.avisos_enviados drop constraint if exists avisos_enviados_tipo_check;
alter table public.avisos_enviados add constraint avisos_enviados_tipo_check check (tipo in ('toma', 'saca', 'comida'));

-- ¿Es un plato que no se cocina (fuera, pedido, sobras, lo que haya)?
create function public.sin_cocinar(p jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$ select coalesce(p -> 'etiquetas' ?| array['Fuera', 'Sin compra'], false) $$;

-- cambiar_hueco ahora también aprende: quitar un plato cuenta un poco en contra y elegir otro, un poco a favor
-- (solo si el nuevo es un plato de verdad: «comemos fuera» o «sobras» no dicen nada de gustos).
create or replace function public.cambiar_hueco(p_menu uuid, p_dia int, p_momento text, p_plato jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.menus;
  antes jsonb;
  plato jsonb := p_plato || jsonb_build_object('elegido', public.quien_elige());
  nuevo jsonb;
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 then
    raise exception 'Día o momento no válido';
  end if;
  select * into m from public.menus
   where id = p_menu and household_id = public.my_household() and estado = 'listo'
     and jsonb_array_length(plan -> 'dias') > p_dia
   for update;
  if not found then raise exception 'No encuentro ese menú'; end if;
  antes := m.plan -> 'dias' -> p_dia -> p_momento;
  nuevo := jsonb_set(m.plan, array['dias', p_dia::text, p_momento], plato);
  if jsonb_array_length(coalesce(m.compra, '[]')) > 0 and not coalesce((m.plan ->> 'compra_vieja')::boolean, false) then
    nuevo := jsonb_set(nuevo, '{cambios}', coalesce(nuevo -> 'cambios', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'dia', p_dia, 'momento', p_momento, 'antes', antes - 'receta', 'por', auth.uid())));
  end if;
  update public.menus set plan = nuevo where id = m.id;

  if not public.sin_cocinar(plato) and antes ->> 'titulo' is distinct from plato ->> 'titulo' then
    if antes is not null and not public.sin_cocinar(antes) and antes -> 'hecho' is null then
      insert into public.opiniones (household_id, user_id, titulo, momento, voto, fuente)
      values (m.household_id, auth.uid(), left(antes ->> 'titulo', 160), p_momento, -1, 'cambio');
    end if;
    insert into public.opiniones (household_id, user_id, titulo, momento, voto, fuente)
    values (m.household_id, auth.uid(), left(plato ->> 'titulo', 160), p_momento, 1, 'cambio');
  end if;
  return plato;
end;
$$;
revoke execute on function public.cambiar_hueco(uuid, int, text, jsonb) from public, anon, authenticated;

-- Sí, lo comimos (p_si true), o deshacer la marca (null).
create function public.marcar_comida(p_menu uuid, p_dia int, p_momento text, p_si boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 then raise exception 'Día o momento no válido'; end if;
  update public.menus m
     set plan = case when p_si is null
                     then m.plan #- array['dias', p_dia::text, p_momento, 'hecho']
                     else jsonb_set(m.plan, array['dias', p_dia::text, p_momento, 'hecho'],
                                    jsonb_build_object('si', p_si, 'at', now(), 'por', auth.uid()))
                end
   where m.id = p_menu and m.household_id = public.my_household() and m.estado = 'listo'
     and jsonb_array_length(m.plan -> 'dias') > p_dia;
  if not found then raise exception 'No encuentro ese menú'; end if;
end;
$$;
revoke execute on function public.marcar_comida(uuid, int, text, boolean) from public, anon;
grant execute on function public.marcar_comida(uuid, int, text, boolean) to authenticated;

-- No lo comimos (comimos p_titulo: «Sobras», «Otra cosa»…).
--  p_que = 'pasar': el plato pasa al siguiente día libre del mismo momento y los demás se corren
--    (fuera, pedidos y lo ya comido se quedan donde están); el que no cabe va a plan.pendientes. La compra no cambia.
--  p_que = 'quitar': el plato sale del menú y la lista se ajusta (hay que llamar luego a «sincronizar»).
create function public.no_comimos(p_menu uuid, p_dia int, p_momento text, p_que text, p_titulo text default 'Sobras')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.menus;
  t text := left(coalesce(nullif(trim(p_titulo), ''), 'Sobras'), 120);
  hoy jsonb;
  mover jsonb;
  hueco jsonb;
  nuevo jsonb;
  marca jsonb := jsonb_build_object('si', false, 'at', now(), 'por', auth.uid());
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 or p_que not in ('pasar', 'quitar') then
    raise exception 'Petición no válida';
  end if;
  select * into m from public.menus
   where id = p_menu and household_id = public.my_household() and estado = 'listo'
     and jsonb_array_length(plan -> 'dias') > p_dia
   for update;
  if not found then raise exception 'No encuentro ese menú'; end if;
  hoy := jsonb_build_object('titulo', t, 'minutos', 0, 'aparato', '', 'etiquetas', '["Sin compra"]'::jsonb,
                            'ingredientes', '[]'::jsonb, 'hecho', marca, 'elegido', public.quien_elige());

  if p_que = 'quitar' then
    perform public.cambiar_hueco(p_menu, p_dia, p_momento, hoy - 'elegido');
    return;
  end if;

  nuevo := m.plan;
  mover := (nuevo -> 'dias' -> p_dia -> p_momento) - 'hecho';
  if public.sin_cocinar(mover) then
    -- No había nada que cocinar: solo se apunta.
    update public.menus set plan = jsonb_set(nuevo, array['dias', p_dia::text, p_momento, 'hecho'], marca) where id = m.id;
    return;
  end if;
  for k in p_dia + 1 .. jsonb_array_length(nuevo -> 'dias') - 1 loop
    hueco := nuevo -> 'dias' -> k -> p_momento;
    continue when public.sin_cocinar(hueco) or hueco -> 'hecho' is not null;
    nuevo := jsonb_set(nuevo, array['dias', k::text, p_momento], mover);
    mover := hueco;
  end loop;
  nuevo := jsonb_set(nuevo, '{pendientes}', coalesce(nuevo -> 'pendientes', '[]'::jsonb)
                    || jsonb_build_array((mover - 'receta') || jsonb_build_object('momento', p_momento)));
  nuevo := jsonb_set(nuevo, array['dias', p_dia::text, p_momento], hoy);
  update public.menus set plan = nuevo where id = m.id;
end;
$$;
revoke execute on function public.no_comimos(uuid, int, text, text, text) from public, anon;
grant execute on function public.no_comimos(uuid, int, text, text, text) to authenticated;

-- Hemos hecho de más: las sobras ocupan los p_n huecos siguientes (almuerzo y cena, por orden).
-- Lo que había allí pasa a plan.pendientes y sus ingredientes salen de la lista (hay que llamar luego a «sincronizar»).
create function public.hay_sobras(p_menu uuid, p_dia int, p_momento text, p_n int)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.menus;
  plato jsonb;
  hueco jsonb;
  pend jsonb := '[]'::jsonb;
  puestos int := 0;
  pos int;
  d int;
  mo text;
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 or p_n not between 1 and 3 then
    raise exception 'Petición no válida';
  end if;
  select * into m from public.menus
   where id = p_menu and household_id = public.my_household() and estado = 'listo'
     and jsonb_array_length(plan -> 'dias') > p_dia
   for update;
  if not found then raise exception 'No encuentro ese menú'; end if;
  plato := m.plan -> 'dias' -> p_dia -> p_momento;
  -- Hueco a hueco desde el siguiente: 0 = lunes almuerzo, 1 = lunes cena…
  pos := p_dia * 2 + case when p_momento = 'cena' then 1 else 0 end + 1;
  while puestos < p_n and pos < jsonb_array_length(m.plan -> 'dias') * 2 loop
    d := pos / 2;
    mo := case when pos % 2 = 0 then 'almuerzo' else 'cena' end;
    select plan -> 'dias' -> d -> mo into hueco from public.menus where id = m.id;
    if not public.sin_cocinar(hueco) and hueco -> 'hecho' is null then
      pend := pend || jsonb_build_array((hueco - 'receta' - 'hecho') || jsonb_build_object('momento', mo));
      perform public.cambiar_hueco(p_menu, d, mo, jsonb_build_object(
        'titulo', left('Sobras: ' || (plato ->> 'titulo'), 120), 'minutos', 5, 'aparato', 'Microondas',
        'etiquetas', '["Sin compra"]'::jsonb, 'ingredientes', '[]'::jsonb));
      puestos := puestos + 1;
    end if;
    pos := pos + 1;
  end loop;
  update public.menus
     set plan = jsonb_set(jsonb_set(plan, array['dias', p_dia::text, p_momento, 'hecho'],
                                    jsonb_build_object('si', true, 'at', now(), 'por', auth.uid())),
                          '{pendientes}', coalesce(plan -> 'pendientes', '[]'::jsonb) || pend)
   where id = m.id;
  return puestos;
end;
$$;
revoke execute on function public.hay_sobras(uuid, int, text, int) from public, anon;
grant execute on function public.hay_sobras(uuid, int, text, int) to authenticated;
