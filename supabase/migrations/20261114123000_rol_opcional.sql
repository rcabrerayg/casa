-- El rol se elige una vez en la app: sin valor hasta entonces.
alter table public.members alter column rol drop not null;
alter table public.members alter column rol drop default;
update public.members set rol = null where rol = 'otro';
