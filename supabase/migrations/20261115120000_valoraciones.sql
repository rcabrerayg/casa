-- Lo que la casa opina de cada plato: el planificador lo lee para aprender vuestros gustos.
create table public.valoraciones (
  household_id uuid not null default public.my_household() references public.households (id) on delete cascade,
  titulo       text not null check (char_length(titulo) between 1 and 160),
  voto         smallint not null check (voto in (-1, 1)),
  momento      text check (momento in ('almuerzo', 'cena')),
  creado_por   uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, titulo)
);
alter table public.valoraciones enable row level security;
revoke all on public.valoraciones from anon;
create policy valoraciones_todo on public.valoraciones
  for all to authenticated
  using (household_id = public.my_household())
  with check (household_id = public.my_household());
