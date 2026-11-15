-- Menú dinámico: al cambiar un plato, la lista de la compra se actualiza sola (solo lo de ese plato).
-- Cada cambio deja en plan.cambios el plato que había; la función «menu» (accion «sincronizar») los procesa en orden.
-- Cada plato elegido a mano guarda quién lo eligió (plan.dias[i][momento].elegido), para dar prioridad a la mamá.

alter table public.menus add column if not exists sincronizando_at timestamptz;

-- Quién es el que cambia, para dejarlo apuntado en el plato.
create or replace function public.quien_elige()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('uid', m.user_id, 'nombre', m.display_name, 'rol', m.rol, 'at', now())
    from public.members m where m.user_id = auth.uid()
$$;
revoke execute on function public.quien_elige() from public, anon;

-- Pone un plato en un hueco del menú y apunta el cambio para que la lista se actualice.
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
  -- Solo hace falta tocar la compra si el menú tiene compra (y no está ya marcada para rehacer entera).
  if jsonb_array_length(coalesce(m.compra, '[]')) > 0 and not coalesce((m.plan ->> 'compra_vieja')::boolean, false) then
    nuevo := jsonb_set(nuevo, '{cambios}', coalesce(nuevo -> 'cambios', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'dia', p_dia, 'momento', p_momento, 'antes', antes - 'receta', 'por', auth.uid())));
  end if;
  update public.menus set plan = nuevo where id = m.id;
  return plato;
end;
$$;
revoke execute on function public.cambiar_hueco(uuid, int, text, jsonb) from public, anon, authenticated;

-- Del recetario (también lo usa la pantalla Recetario).
create or replace function public.poner_receta(p_menu uuid, p_dia int, p_momento text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recetario;
begin
  select * into r from public.recetario where slug = p_slug;
  if not found then raise exception 'No existe esa receta'; end if;
  return public.cambiar_hueco(p_menu, p_dia, p_momento, jsonb_build_object(
    'titulo', r.titulo, 'minutos', r.minutos, 'aparato', r.aparato, 'etiquetas', to_jsonb(r.etiquetas),
    'ingredientes', to_jsonb(r.ingredientes), 'recetario', r.slug,
    'receta', jsonb_build_object('raciones', r.raciones, 'pasos', to_jsonb(r.pasos),
                                 'consejo', trim(r.truco || ' ' || r.conservacion))));
end;
$$;

-- Escrito a mano, «comemos fuera / pedimos» (p_fuera) o «lo que haya en casa» (p_sin_compra): estos dos últimos no compran nada.
drop function if exists public.poner_plato(uuid, int, text, text, boolean);
create function public.poner_plato(p_menu uuid, p_dia int, p_momento text, p_titulo text, p_fuera boolean default false, p_sin_compra boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text := trim(coalesce(p_titulo, ''));
begin
  if char_length(t) < 2 or char_length(t) > 120 then
    raise exception 'Escribe el plato (de 2 a 120 letras)';
  end if;
  return public.cambiar_hueco(p_menu, p_dia, p_momento, jsonb_build_object(
    'titulo', t, 'minutos', 0, 'aparato', '',
    'etiquetas', case when p_fuera then '["Fuera"]'::jsonb when p_sin_compra then '["Sin compra"]'::jsonb else '["A mano"]'::jsonb end,
    'ingredientes', '[]'::jsonb));
end;
$$;
revoke execute on function public.poner_plato(uuid, int, text, text, boolean, boolean) from public, anon;
grant execute on function public.poner_plato(uuid, int, text, text, boolean, boolean) to authenticated;

-- Cambiar un plato de día con otro (mismo momento). La compra de la semana no cambia.
create or replace function public.intercambiar_dias(p_menu uuid, p_momento text, p_dia int, p_otro int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.menus;
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 or p_otro not between 0 and 6 or p_dia = p_otro then
    raise exception 'Días no válidos';
  end if;
  select * into m from public.menus
   where id = p_menu and household_id = public.my_household() and estado = 'listo'
     and jsonb_array_length(plan -> 'dias') > greatest(p_dia, p_otro)
   for update;
  if not found then raise exception 'No encuentro ese menú'; end if;
  update public.menus set plan = jsonb_set(jsonb_set(m.plan,
      array['dias', p_dia::text, p_momento], m.plan -> 'dias' -> p_otro -> p_momento),
      array['dias', p_otro::text, p_momento], m.plan -> 'dias' -> p_dia -> p_momento)
   where id = m.id;
end;
$$;
revoke execute on function public.intercambiar_dias(uuid, text, int, int) from public, anon;
grant execute on function public.intercambiar_dias(uuid, text, int, int) to authenticated;

-- Lo usa la función «menu» (service_role) al terminar un lote de cambios:
-- quita los p_n primeros cambios procesados, guarda la compra nueva y retoca la lista
-- (solo lo que vino de este menú y aún no se ha comprado; lo apuntado a mano no se toca).
create or replace function public.aplicar_cambios_compra(p_menu uuid, p_n int, p_compra jsonb, p_quitadas jsonb, p_nuevas jsonb, p_platos jsonb)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  m public.menus;
  l jsonb;
  p jsonb;
  plan_nuevo jsonb;
  en_lista boolean;
  item uuid;
  tocados int := 0;
begin
  select * into m from public.menus where id = p_menu for update;
  if not found then return 0; end if;
  plan_nuevo := jsonb_set(m.plan, '{cambios}',
    coalesce((select jsonb_agg(c order by i) from jsonb_array_elements(m.plan -> 'cambios') with ordinality x(c, i) where i > p_n), '[]'::jsonb));
  -- Ingredientes deducidos para los platos escritos a mano (si el plato sigue siendo el mismo).
  for p in select * from jsonb_array_elements(coalesce(p_platos, '[]')) loop
    if plan_nuevo -> 'dias' -> (p ->> 'dia')::int -> (p ->> 'momento') ->> 'titulo' = p ->> 'titulo' then
      plan_nuevo := jsonb_set(plan_nuevo, array['dias', p ->> 'dia', p ->> 'momento', 'ingredientes'], p -> 'ingredientes');
    end if;
  end loop;
  update public.menus
     set plan = plan_nuevo, compra = p_compra, sincronizando_at = null,
         total = round(coalesce((select sum((c ->> 'coste')::numeric) from jsonb_array_elements(p_compra) c), 0), 2)
   where id = m.id;

  en_lista := exists (select 1 from public.lista_items where menu_id = m.id);
  if not en_lista then return 0; end if;

  for l in select * from jsonb_array_elements(coalesce(p_quitadas, '[]')) loop
    select li.id into item from public.lista_items li
     where li.menu_id = m.id and li.comprado_at is null
       and (li.producto_id::text = l -> 'producto' ->> 'id'
            or (l -> 'producto' is null or l -> 'producto' = 'null'::jsonb) and li.texto like (l ->> 'ingrediente') || '%')
     order by li.created_at desc limit 1;
    if found then
      delete from public.lista_items where id = item;
      tocados := tocados + 1;
    end if;
  end loop;

  for l in select * from jsonb_array_elements(coalesce(p_nuevas, '[]')) loop
    insert into public.lista_items (household_id, texto, cantidad, producto_id, super_fijo, menu_id)
    values (m.household_id,
            left(coalesce(l -> 'producto' ->> 'nombre', (l ->> 'ingrediente') || ' (' || (l ->> 'cantidad') || ')'), 120),
            greatest(1, least(99, coalesce((l ->> 'unidades')::int, 1))),
            (l -> 'producto' ->> 'id')::uuid,
            case when (l ->> 'por_regla')::boolean and l -> 'producto' ->> 'super' in ('mercadona', 'hiperdino')
                 then l -> 'producto' ->> 'super' end,
            m.id);
    tocados := tocados + 1;
  end loop;
  return tocados;
end;
$$;
revoke execute on function public.aplicar_cambios_compra(uuid, int, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_cambios_compra(uuid, int, jsonb, jsonb, jsonb, jsonb) to service_role;
