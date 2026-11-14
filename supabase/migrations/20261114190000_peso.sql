-- Peso del bebé (en gramos), apuntado tras cada pesada.
alter table public.baby_events drop constraint baby_events_kind_check;
alter table public.baby_events
  add constraint baby_events_kind_check check (kind in ('toma', 'panal', 'dormido', 'despierto', 'extraccion', 'peso'));
alter table public.baby_events add column gramos integer check (gramos between 1000 and 15000);
alter table public.baby_events
  add constraint peso_tiene_gramos check (kind <> 'peso' or gramos is not null);
