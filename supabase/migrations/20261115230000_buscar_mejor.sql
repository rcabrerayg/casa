-- Búsqueda: primero el producto que ES lo buscado, no el que lo lleva de sabor.
-- «plátano» → plátanos al peso antes que «bebida de fresa y plátano».
-- Orden: posición de la palabra en el nombre (sin marca blanca delante, singular/plural da igual),
-- luego al peso/granel, luego si la categoría también lo nombra, luego nombre más corto.
create or replace function public.buscar_productos(q text, p_super text default null)
returns setof public.productos
language sql
stable
set search_path = ''
as $$
  with t as (
    select public.normaliza(trim(q)) as q,
           array_remove(regexp_split_to_array(public.normaliza(trim(q)), '\s+'), '') as palabras
  ),
  c as (
    select p.*,
           trim(regexp_replace(p.nombre_norm, '^(hiperdino|hacendado|ifa eliges|eliges|bosque verde|deliplus|compy|dia)\s+', '')) as base,
           regexp_replace(t.palabras[1], 's$', '') as w1
    from public.productos p, t
    where p.activo
      and (p_super is null or p.super = p_super)
      and char_length(t.q) >= 2
      and not exists (select 1 from unnest(t.palabras) w where p.nombre_norm not like '%' || w || '%')
  ),
  r as (
    select c.*,
           (select min(o.n) from unnest(regexp_split_to_array(c.base, '[^a-z0-9]+')) with ordinality o(pal, n)
             where regexp_replace(o.pal, 's$', '') = c.w1) as pos
    from c
  )
  select r.id, r.super, r.ext_id, r.nombre, r.nombre_norm, r.formato, r.categoria, r.imagen, r.url,
         r.precio, r.precio_unidad, r.unidad, r.precio_antes, r.visto_at, r.cambiado_at, r.activo
  from r, t
  order by case when r.pos = 1 then 0 when r.pos = 2 then 1 when r.pos is not null then 2 else 3 end,
           (coalesce(r.formato, '') || ' ' || r.nombre_norm) ~* '(granel|al peso)' desc,
           public.normaliza(coalesce(r.categoria, '')) like '%' || r.w1 || '%' desc,
           char_length(r.base),
           extensions.word_similarity(t.q, r.nombre_norm) desc,
           r.precio_unidad nulls last, r.precio
  limit 40
$$;
