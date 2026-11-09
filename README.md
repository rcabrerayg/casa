# Casa

Recordatorios, registro del bebé y compra para casa, sin ruido. App web instalable (PWA) para dos móviles, con Supabase detrás.

## Desarrollo

```bash
npm install
npm run dev   # http://localhost:5173/casa/
```

Variables en `.env.local` (no se suben): `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (clave publicable) y `VITE_VAPID_PUBLIC_KEY`.
En GitHub van como variables del repositorio para el despliegue.

## Supabase

- Migraciones en `supabase/migrations/`, se aplican con `supabase db push`.
- Función `send-test-push`: envía un aviso de prueba a los móviles del hogar. Usa los secretos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `VAPID_SUBJECT`.
- Todas las tablas con RLS por hogar; nada es accesible sin sesión.
