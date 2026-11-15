-- El resumen de la semana se reescribe con cada cambio de plato.
drop function if exists public.aplicar_cambios_compra(uuid, int, jsonb, jsonb, jsonb, jsonb);
-- Lo usa la función «menu» (service_role) al terminar un lote de cambios:
-- quita los p_n primeros cambios procesados, guarda la compra nueva y retoca la lista
-- (solo lo que vino de este menú y aún no se ha comprado; lo apuntado a mano no se toca).
create or replace function public.aplicar_cambios_compra(p_menu uuid, p_n int, p_compra jsonb, p_quitadas jsonb, p_nuevas jsonb, p_platos jsonb, p_resumen text default null)
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
  if coalesce(trim(p_resumen), '') <> '' then
    plan_nuevo := jsonb_set(plan_nuevo, '{resumen}', to_jsonb(left(trim(p_resumen), 400)));
  end if;
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
revoke execute on function public.aplicar_cambios_compra(uuid, int, jsonb, jsonb, jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.aplicar_cambios_compra(uuid, int, jsonb, jsonb, jsonb, jsonb, text) to service_role;
