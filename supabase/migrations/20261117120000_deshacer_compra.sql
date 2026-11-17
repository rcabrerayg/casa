-- Desmarcar algo de la lista (botón «Deshacer» o tocarlo otra vez) deshace lo que hizo al marcarlo:
-- quita la línea del historial de compras y resta lo sumado en la despensa.
create or replace function public.al_comprar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.inventario;
  hay boolean;
  item public.lista_items := case when new.comprado_at is not null then new else old end;
begin
  if (new.comprado_at is null) = (old.comprado_at is null) then
    return new;
  end if;

  select * into inv from public.inventario i
   where i.household_id = item.household_id
     and ((item.producto_id is not null and i.producto_id = item.producto_id) or public.encaja(item.texto, i.nombre))
   order by (i.producto_id = item.producto_id) desc nulls last
   limit 1;
  hay := found;

  if new.comprado_at is not null then
    insert into public.compras_historial (household_id, texto, producto_id, cantidad, comprado_at, comprado_por)
    values (new.household_id, new.texto, new.producto_id, new.cantidad, new.comprado_at, new.comprado_por);
    if hay then
      update public.inventario
         set cantidad = greatest(0, inv.cantidad - inv.consumo_dia * extract(epoch from now() - inv.actualizado_at) / 86400)
                        + new.cantidad * inv.por_envase,
             actualizado_at = now()
       where id = inv.id;
    end if;
  else
    delete from public.compras_historial h
     where h.household_id = old.household_id and h.texto = old.texto and h.comprado_at = old.comprado_at;
    if found and hay then
      update public.inventario
         set cantidad = greatest(0, inv.cantidad - old.cantidad * inv.por_envase)
       where id = inv.id;
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.al_comprar() from public, anon, authenticated;
