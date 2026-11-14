-- Avisos al móvil: preferencias por persona, frecuencia de tomas por casa
-- y registro de lo enviado para no repetir.

alter table public.members
  add column aviso_tomas boolean not null default true,
  add column aviso_saca  boolean,          -- null = según rol (mamá sí, resto no)
  add column aviso_noche boolean not null default true;

alter table public.households
  add column toma_cada_min integer not null default 180 check (toma_cada_min between 60 and 360),
  add column saca_cada_min integer not null default 210 check (saca_cada_min between 90 and 480);

-- Solo lo usa la función de avisos (service role). Sin políticas = cerrado a la app.
create table public.avisos_enviados (
  user_id    uuid not null references auth.users (id) on delete cascade,
  tipo       text not null check (tipo in ('toma', 'saca')),
  ref_id     uuid not null,
  enviado_at timestamptz not null default now(),
  primary key (user_id, tipo, ref_id)
);
revoke all on public.avisos_enviados from anon, authenticated;
alter table public.avisos_enviados enable row level security;

-- Revisión periódica: pg_cron llama a la función con un secreto guardado en Vault.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'casa-recordatorios',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://wokoivpcjvaqnjyuqmjb.supabase.co/functions/v1/recordatorios',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'casa_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
