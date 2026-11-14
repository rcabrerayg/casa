-- Casa · bloque 1: el bebé primero.

-- Quién es quién en casa (para los mensajes de ánimo a la mamá).
alter table public.members
  add column rol text not null default 'otro' check (rol in ('mama', 'papa', 'otro'));

-- Hora exacta de nacimiento (la fecha sola no basta para la edad en horas/días).
alter table public.people add column birth_at timestamptz;

-- Registro del bebé. El id lo genera el móvil para poder apuntar sin conexión
-- y reintentar sin duplicar.
create table public.baby_events (
  id           uuid primary key,
  household_id uuid not null references public.households (id) on delete cascade,
  person_id    uuid not null references public.people (id) on delete cascade,
  kind         text not null check (kind in ('toma', 'panal', 'dormido', 'despierto')),
  side         text check (side in ('izq', 'dcho', 'bib')),
  ml           integer check (ml between 5 and 400),
  panal        text check (panal in ('pipi', 'caca', 'ambos')),
  at           timestamptz not null default now(),
  created_by   uuid not null default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint toma_tiene_lado check (kind <> 'toma' or side is not null),
  constraint panal_tiene_tipo check (kind <> 'panal' or panal is not null)
);
create index baby_events_person_at_idx on public.baby_events (person_id, at desc);
create index baby_events_household_idx on public.baby_events (household_id);

revoke all on public.baby_events from anon;
alter table public.baby_events enable row level security;

-- La persona tiene que ser del mismo hogar (evita apuntar en un bebé ajeno).
create function public.person_in_my_household(p_person uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.people p
    where p.id = p_person and p.household_id = public.my_household()
  )
$$;
revoke execute on function public.person_in_my_household(uuid) from public, anon, authenticated;
grant execute on function public.person_in_my_household(uuid) to authenticated, service_role;

create policy baby_events_select on public.baby_events
  for select to authenticated using (household_id = public.my_household());
create policy baby_events_insert on public.baby_events
  for insert to authenticated
  with check (
    household_id = public.my_household()
    and created_by = auth.uid()
    and public.person_in_my_household(person_id)
  );
create policy baby_events_update on public.baby_events
  for update to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household() and public.person_in_my_household(person_id));
create policy baby_events_delete on public.baby_events
  for delete to authenticated using (household_id = public.my_household());

-- Tiempo real: lo que apunta uno le llega al otro al momento (respeta RLS).
alter publication supabase_realtime add table public.baby_events;
