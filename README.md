# Casa

Recordatorios, registro del bebé y compra para casa, sin ruido. App web instalable (PWA) para dos móviles, con Supabase detrás.

## Desarrollo

```bash
npm install
npm run dev   # http://localhost:5173/casa/
```

Variables en `.env.local` (no se suben): `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY` (clave publicable) y `VITE_VAPID_PUBLIC_KEY`.
En GitHub van como variables del repositorio para el despliegue.

## Cómo está organizada

Tres pestañas abajo y los ajustes en el engranaje de «Ahora»:

- **Ahora** (inicio): cuánto hace de la última toma de Darío y atajos a «Apuntar toma» y «Pañal», el sacaleches cuando toca, un mensaje de ánimo, la comida de hoy del menú y lo que queda por comprar. Solo aparece lo que aplica.
- **Darío**: estado arriba y cuatro botones (Comer, Pañal, Sueño, Sacaleches) que abren un panel inferior. El peso va como acción secundaria. Arriba, «Hoy | Para el pediatra» (tabla por días para compartir). Todo se guarda primero en el móvil (`src/lib/bebe.ts`, cola sin pérdidas) y se sube cuando hay red.
- **Comida**: Menú (con «Buscar en el recetario»), Lista (repartida entre Mercadona e HiperDino) y Despensa (lo que hay en casa; «Más opciones» al tocar un nombre).
- **Ajustes**: avisos de este móvil, cada cuánto avisar, quién está en casa y salir.

Modo oscuro automático de 21:00 a 08:00 (hora de Canarias) o si el sistema lo pide; Darío va siempre en oscuro (`src/lib/tema.ts`). Botones, chips y colores salen de los tokens de `src/index.css`.

## Supabase

- Migraciones en `supabase/migrations/`, se aplican con `supabase db push`.
- Todas las tablas con RLS por hogar (`public.my_household()`); nada es accesible sin sesión.

Funciones (`supabase/functions/`):

| Función | Qué hace | Secretos |
| --- | --- | --- |
| `send-test-push` | Aviso de prueba a los móviles del hogar. | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` |
| `recordatorios` | pg_cron la llama cada 10 min: avisa de toma o sacaleches, un aviso por hueco. | `CRON_SECRET`, `VAPID_*` |
| `precios` | Rastreo nocturno de precios de Mercadona e HiperDino Tenerife (cola `precios_cola`, cron `casa-precios`). | `CRON_SECRET` |
| `menu` | Prepara el menú semanal y escribe recetas con Claude. | `ANTHROPIC_API_KEY`, `MENU_MODELO` (opcional, modelo a usar) |

`CRON_SECRET` es el secreto compartido entre pg_cron y las funciones que llama. Los secretos se guardan con `supabase secrets set` y nunca en el repositorio.
