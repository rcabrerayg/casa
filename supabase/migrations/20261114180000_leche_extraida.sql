-- Leche materna extraída (dada con jeringa y dedo, biberón o vasito) y sesiones de sacaleches.
alter table public.baby_events drop constraint baby_events_kind_check;
alter table public.baby_events
  add constraint baby_events_kind_check check (kind in ('toma', 'panal', 'dormido', 'despierto', 'extraccion'));

alter table public.baby_events drop constraint baby_events_side_check;
alter table public.baby_events
  add constraint baby_events_side_check check (side in ('izq', 'dcho', 'bib', 'extraida', 'ambos'));

alter table public.baby_events
  add column metodo text check (metodo in ('jeringa', 'biberon', 'vasito'));

-- Una extracción dice de qué pecho; una toma de leche extraída o de fórmula lleva sus ml.
alter table public.baby_events
  add constraint extraccion_tiene_lado check (kind <> 'extraccion' or side in ('izq', 'dcho', 'ambos'));
alter table public.baby_events
  add constraint lado_coherente check (
    (kind = 'toma' and side in ('izq', 'dcho', 'bib', 'extraida'))
    or (kind = 'extraccion' and side in ('izq', 'dcho', 'ambos'))
    or (kind not in ('toma', 'extraccion') and side is null)
  );
