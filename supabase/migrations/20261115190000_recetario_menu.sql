-- Recetario desde la app: qué producto concreto del catálogo corresponde a cada ingrediente clave,
-- y poner una receta del libro en un día del menú.

-- Para cada ingrediente clave de cada receta (o de una), el producto más barato por kg/l/unidad que encaja.
create function public.recetario_productos(p_slug text default null)
returns table (slug text, ord bigint, q text, cant numeric, producto_id uuid, nombre text, super text,
               precio numeric, precio_antes numeric, por_unidad numeric)
language sql
stable
set search_path = ''
as $$
  with c as (
    select r.slug, k.ord, k.v ->> 'q' as q, (k.v ->> 'cant')::numeric as cant, k.v ->> 'u' as u, k.v -> 'x' as x
    from public.recetario r, jsonb_array_elements(r.claves) with ordinality as k(v, ord)
    where p_slug is null or r.slug = p_slug
  )
  select distinct on (c.slug, c.ord) c.slug, c.ord, c.q, c.cant, b.id, b.nombre, b.super, b.precio, b.precio_antes, b.por_unidad
  from c
  left join lateral (
    select p.id, p.nombre, p.super, p.precio, p.precio_antes,
           p.precio_unidad * case when p.unidad in ('100 g', '100 ml') then 10 else 1 end as por_unidad
    from public.buscar_productos(c.q, null) p
    where p.precio_unidad > 0
      and case when c.u = 'ud' then p.unidad in ('ud', 'dc', 'dz') else p.unidad in ('kg', 'l', '100 g', '100 ml') end
      and not exists (
        select 1 from jsonb_array_elements_text(coalesce(c.x, '[]')) w
        where p.nombre_norm like '%' || public.normaliza(w) || '%'
      )
  ) b on true
  order by c.slug, c.ord, b.por_unidad nulls last
$$;
revoke execute on function public.recetario_productos(text) from public, anon;
grant execute on function public.recetario_productos(text) to authenticated, service_role;

-- Mismo cálculo que antes, ahora sobre recetario_productos.
create or replace function public.recetario_costes()
returns table (slug text, coste numeric, en_oferta boolean, ofertas text[], sin_precio text[])
language sql
stable
set search_path = ''
as $$
  select e.slug,
         round(0.8 + coalesce(sum(e.cant * e.por_unidad), 0), 2),
         coalesce(bool_or(e.precio_antes > e.precio), false),
         array_remove(array_agg(case when e.precio_antes > e.precio then e.q end order by e.ord), null),
         array_remove(array_agg(case when e.por_unidad is null then e.q end order by e.ord), null)
  from public.recetario_productos() e
  group by e.slug
$$;

-- Cambia el almuerzo o la cena de un día del menú por una receta del recetario (los menús no se editan directamente).
create function public.poner_receta(p_menu uuid, p_dia int, p_momento text, p_slug text)
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
     set plan = jsonb_set(m.plan, array['dias', p_dia::text, p_momento], plato)
   where m.id = p_menu
     and m.household_id = public.my_household()
     and m.estado = 'listo'
     and jsonb_array_length(m.plan -> 'dias') > p_dia;
  if not found then raise exception 'No encuentro ese menú'; end if;
  return plato;
end;
$$;
revoke execute on function public.poner_receta(uuid, int, text, text) from public, anon;
grant execute on function public.poner_receta(uuid, int, text, text) to authenticated;
