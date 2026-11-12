# Conectar Google Calendar

Módulo opcional: cada cita confirmada crea su evento en un calendario de Google; si la cita se mueve o se cancela, el evento se actualiza o se borra. La agenda oficial sigue siendo D1. El calendario es un reflejo de un solo sentido: mover o borrar un evento a mano en Google no cambia la cita.

**Estado de prueba:** verificado en una demo de estética con una llamada real. En producción se probó crear, por la tarea programada y por la llamada. Mover y cancelar solo se probaron en local. No se probó en otras plantillas ni en modo production. No prometas más que eso.

## Lo que no sirve

El Worker corre en Cloudflare y no puede usar la conexión del CLI de Composio ni la del panel «Para ti»: esas viven en la sesión personal de quien las creó. Con la clave del CLI la API responde `No connected account found`. Hace falta una clave del **proyecto** en el modo Plataforma de https://dashboard.composio.dev, y Google Calendar conectado dentro de ese proyecto.

## Pasos

1. **Clave del proyecto.** En Plataforma → Claves API → Crear. Los permisos no se pueden cambiar después: marca escritura en *Ejecución de herramientas (heredado)*, *Cuentas conectadas* y *Configuraciones de autenticación*, y deja las lecturas por defecto. Guárdala en un archivo oculto del proyecto (`.secrets/`). Nunca la pidas por el chat ni la escribas en la respuesta.
2. **Configuración de autenticación.** `POST https://backend.composio.dev/api/v3/auth_configs` con `{"toolkit":{"slug":"googlecalendar"},"auth_config":{"type":"use_composio_managed_auth","name":"…"}}` y el encabezado `x-api-key`. Anota el `id`.
3. **Enlace para el dueño del calendario.** `POST /api/v3/connected_accounts/link` con `{"auth_config_id":"…","user_id":"<identificador del proyecto o del cliente>"}`. Devuelve `redirect_url` y `connected_account_id`. El dueño abre el enlace y autoriza con un clic. El enlace del CLI (`composio link`) no sirve: conecta a la sesión de quien lo ejecuta.
4. **Calendario aparte.** Crea uno con `GOOGLECALENDAR_CREATE_CALENDAR` y usa su `id` como `CALENDAR_ID`. Así la demo no se mezcla con la agenda real y se borra entera después.
5. **Configuración del Worker.** En `wrangler.jsonc`, `vars`: `COMPOSIO_USER_ID`, `COMPOSIO_ACCOUNT_ID` y `CALENDAR_ID`. El secreto: `npx wrangler secret put COMPOSIO_API_KEY < .secrets/archivo`. Sin la clave o sin `CALENDAR_ID`, el módulo no hace nada.
6. **Copiar el módulo.** `modules/calendar.ts.txt` va a `worker/calendar.ts`. `modules/calendar.sql` va a `migrations/` con el siguiente número libre. Agrega `worker/env.d.ts` con `interface Env { COMPOSIO_API_KEY?: string }` si `npm run types` no la incluye.
7. **Enlazar en `worker/index.ts`.** Importa `syncCalendar` y `syncInBackground`. Llama `syncInBackground(c)` después de cada `commit` (la ruta del dashboard y la tool `commit_appointment_change`). En `scheduled`, al final, `await syncCalendar(env).catch(() => undefined)`. La tarea programada reintenta hasta 5 veces las citas que fallaron.
8. **Migrar, compilar y desplegar.** `npm run db:remote`, `npm run build` y `npm run deploy`.

## Cómo probarlo

- En local: `wrangler dev --test-scheduled`, inserta una cita con `source='agent'`, y dispara `/cdn-cgi/handler/scheduled`. Comprueba el evento en Google, mueve la cita (sube `version`) y cancélala.
- Las citas con `source='demo'` (datos de ejemplo) no se sincronizan.
- Si `COMPOSIO_API_KEY` está en `.dev.vars`, las pruebas de integración crean eventos reales. Bórralos al terminar, o prueba sin la clave.
- En producción, una llamada real desde el dashboard y revisar el evento. Una cita insertada a mano en la base real espera hasta 5 minutos al cron.
- Apaga todo lo que levantes en local y borra los eventos y citas de prueba.

## Límites y riesgos

- El evento lleva nombre y teléfono de la persona. Con clientes reales hay que pedir su consentimiento, decirlo en el contrato y valorar quitar el teléfono.
- Si Composio falla después de crear el evento y antes de guardarlo, un reintento puede duplicarlo.
- En modo demo la cita sale a nombre de la identidad ficticia que elige administración, no de quien llama.
- Quién tiene la cuenta de Composio es una decisión comercial: un proyecto de la agencia, con un `user_id` por cliente (el cliente solo autoriza su calendario y tú dependes de tu cuenta), o la cuenta propia del cliente (más independencia, más pasos para él). No verifiqué precios ni límites de Composio para varios clientes: consúltalos antes de cotizar.
