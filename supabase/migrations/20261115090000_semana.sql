-- Menú semanal tipo Whipp: preferencias de la casa y menús generados con Claude.

create table public.preferencias (
  household_id      uuid primary key default public.my_household() references public.households (id) on delete cascade,
  presupuesto       numeric(6, 2) not null default 60 check (presupuesto between 10 and 500),
  personas          smallint not null default 2 check (personas between 1 and 10),
  electrodomesticos text[] not null default '{}',
  gustos            text[] not null default '{}',
  evitar            text not null default '' check (char_length(evitar) <= 500),
  notas             text not null default '' check (char_length(notas) <= 1000),
  desayuno          text not null default '' check (char_length(desayuno) <= 300),
  postcena          text not null default 'Un vaso de leche con algo dulce: galletas, magdalenas o similar.' check (char_length(postcena) <= 300),
  reglas            text[] not null default array[
    'La leche, siempre Hacendado de Mercadona.',
    'La carne, casi siempre de HiperDino.'
  ],
  updated_at        timestamptz not null default now()
);
alter table public.preferencias enable row level security;
revoke all on public.preferencias from anon;
create policy preferencias_todo on public.preferencias
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());

create table public.menus (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  semana       date not null,
  estado       text not null default 'generando' check (estado in ('generando', 'listo', 'error')),
  paso         text,
  error        text,
  plan         jsonb,
  compra       jsonb,
  total        numeric(8, 2),
  creado_por   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index menus_household_idx on public.menus (household_id, created_at desc);
alter table public.menus enable row level security;
revoke all on public.menus from anon;
-- La app solo lee y borra; los crea la función `menu` (service role).
create policy menus_leer on public.menus for select to authenticated using (household_id = public.my_household());
create policy menus_borrar on public.menus for delete to authenticated using (household_id = public.my_household());
revoke insert, update on public.menus from authenticated;
alter publication supabase_realtime add table public.menus;

-- Qué cosas de la lista vienen de un menú (para reemplazarlas si se rehace).
alter table public.lista_items add column menu_id uuid references public.menus (id) on delete set null;
