-- Equivalentes: además del nombre, premia un envase de tamaño parecido
-- (tamaño ≈ precio / precio por kg o litro).
create or replace function public.equivalentes(p_producto uuid)
returns table (id uuid, super text, nombre text, formato text, precio numeric, precio_unidad numeric, unidad text, parecido real)
language sql
stable
set search_path = ''
as $$
  with o as (select * from public.productos where id = p_producto),
  limpio as (
    select o.*,
           trim(regexp_replace(o.nombre_norm, '\m(hacendado|bosque verde|deliplus|compy|hiperdino|dia|happyday)\M', '', 'g')) as base,
           case when o.precio_unidad > 0 then o.precio / o.precio_unidad end as tam
    from o
  )
  select p.id, p.super, p.nombre, p.formato, p.precio, p.precio_unidad, p.unidad,
         (extensions.similarity(l.base, p.nombre_norm)
          + case when p.unidad = l.unidad then 0.1 else 0 end
          + case when p.unidad = l.unidad and l.tam > 0 and p.precio_unidad > 0
                 then 0.2 * greatest(0, 1 - abs(ln((p.precio / p.precio_unidad) / l.tam)))
                 else 0 end)::real as parecido
  from public.productos p, limpio l
  where p.super <> l.super and p.activo
    and extensions.similarity(l.base, p.nombre_norm) > 0.2
  order by parecido desc
  limit 6
$$;
revoke execute on function public.equivalentes(uuid) from public, anon;
grant execute on function public.equivalentes(uuid) to authenticated, service_role;
