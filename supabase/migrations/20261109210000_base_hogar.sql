-- Casa · bloque 0: hogar, miembros, personas y suscripciones push.
-- Seguro por defecto: nada nuevo es accesible para anon; todo filtra por hogar.

-- 1. Prevención estructural: los objetos nuevos no nacen abiertos.
alter default privileges in schema public revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- 2. Tablas
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Casa',
  invite_code text not null unique default substr(replace(gen_random_uuid()::text, '-', ''), 1, 12),
  timezone    text not null default 'Atlantic/Canary',
  created_at  timestamptz not null default now()
);

create table public.members (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at   timestamptz not null default now()
);
create index members_household_idx on public.members (household_id);

create table public.people (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 40),
  kind         text not null check (kind in ('adulto', 'bebe')),
  birth_date   date,
  created_at   timestamptz not null default now()
);
create index people_household_idx on public.people (household_id);

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index push_subscriptions_household_idx on public.push_subscriptions (household_id);

revoke all on all tables in schema public from anon;

-- 3. Helper: el hogar del usuario que llama (salta RLS solo para leer members).
create function public.my_household()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id from public.members m where m.user_id = auth.uid()
$$;
revoke execute on function public.my_household() from public, anon, authenticated;
grant execute on function public.my_household() to authenticated, service_role;

-- 4. RLS
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.people enable row level security;
alter table public.push_subscriptions enable row level security;

create policy households_select on public.households
  for select to authenticated using (id = public.my_household());
create policy households_update on public.households
  for update to authenticated using (id = public.my_household()) with check (id = public.my_household());

create policy members_select on public.members
  for select to authenticated using (household_id = public.my_household());
create policy members_update_self on public.members
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and household_id = public.my_household());

create policy people_all on public.people
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

create policy push_select_own on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy push_insert_own on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid() and household_id = public.my_household());
create policy push_delete_own on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- 5. RPCs: crear hogar y unirse con código. Validan auth.uid() dentro.
create function public.create_household(p_name text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  insert into public.households (name) values (coalesce(nullif(trim(p_name), ''), 'Casa'))
    returning id into v_id;
  insert into public.members (user_id, household_id, display_name)
    values (v_uid, v_id, trim(p_display_name));
  return v_id;
end;
$$;
revoke execute on function public.create_household(text, text) from public, anon, authenticated;
grant execute on function public.create_household(text, text) to authenticated, service_role;

create function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if exists (select 1 from public.members where user_id = v_uid) then
    raise exception 'Ya perteneces a un hogar';
  end if;
  select h.id into v_id from public.households h where h.invite_code = lower(trim(p_code));
  if v_id is null then
    raise exception 'Código no válido';
  end if;
  insert into public.members (user_id, household_id, display_name)
    values (v_uid, v_id, trim(p_display_name));
  return v_id;
end;
$$;
revoke execute on function public.join_household(text, text) from public, anon, authenticated;
grant execute on function public.join_household(text, text) to authenticated, service_role;
