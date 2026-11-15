-- Al cambiar un plato a mano, la compra del menú queda marcada como vieja hasta que se rehaga.
create or replace function public.poner_receta(p_menu uuid, p_dia int, p_momento text, p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.recetario;
  plato jsonb;
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 then
    raise exception 'Día o momento no válido';
  end if;
  select * into r from public.recetario where slug = p_slug;
  if not found then raise exception 'No existe esa receta'; end if;
  plato := jsonb_build_object(
    'titulo', r.titulo, 'minutos', r.minutos, 'aparato', r.aparato, 'etiquetas', to_jsonb(r.etiquetas),
    'ingredientes', to_jsonb(r.ingredientes), 'recetario', r.slug,
    'receta', jsonb_build_object('raciones', r.raciones, 'pasos', to_jsonb(r.pasos),
                                 'consejo', trim(r.truco || ' ' || r.conservacion)));
  update public.menus m
     set plan = jsonb_set(m.plan, array['dias', p_dia::text, p_momento], plato) || '{"compra_vieja": true}'::jsonb
   where m.id = p_menu
     and m.household_id = public.my_household()
     and m.estado = 'listo'
     and jsonb_array_length(m.plan -> 'dias') > p_dia;
  if not found then raise exception 'No encuentro ese menú'; end if;
  return plato;
end;
$$;

create or replace function public.poner_plato(p_menu uuid, p_dia int, p_momento text, p_titulo text, p_fuera boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  plato jsonb;
  t text := trim(coalesce(p_titulo, ''));
begin
  if p_momento not in ('almuerzo', 'cena') or p_dia not between 0 and 6 then
    raise exception 'Día o momento no válido';
  end if;
  if char_length(t) < 2 or char_length(t) > 120 then
    raise exception 'Escribe el plato (de 2 a 120 letras)';
  end if;
  plato := jsonb_build_object(
    'titulo', t, 'minutos', 0, 'aparato', '',
    'etiquetas', case when p_fuera then '["Fuera"]'::jsonb else '["A mano"]'::jsonb end,
    'ingredientes', '[]'::jsonb);
  update public.menus m
     set plan = jsonb_set(m.plan, array['dias', p_dia::text, p_momento], plato) || '{"compra_vieja": true}'::jsonb
   where m.id = p_menu
     and m.household_id = public.my_household()
     and m.estado = 'listo'
     and jsonb_array_length(m.plan -> 'dias') > p_dia;
  if not found then raise exception 'No encuentro ese menú'; end if;
  return plato;
end;
$$;
