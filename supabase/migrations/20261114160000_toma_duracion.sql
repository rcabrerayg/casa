-- Tomas con duración: se empieza al tocar el pecho y se termina con un botón.
alter table public.baby_events add column ended_at timestamptz;
alter table public.baby_events
  add constraint fin_despues_de_inicio check (ended_at is null or ended_at >= at);
