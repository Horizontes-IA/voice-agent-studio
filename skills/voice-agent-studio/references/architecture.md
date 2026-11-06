# Mapa de implementación

- `worker/index.ts`: autenticación, dashboard, tools con doble secreto/sesión, origen, webhook y rutas de administración.
- `worker/data.ts`: interfaces, agente inicial y semillas generadas por configuración.
- `worker/booking.ts`: compatibilidad, recursos configurables, horarios, holds, cambios atómicos y recuperación idempotente.
- `worker/rules.ts`: intersección de horarios y turnos, cierres, recursos por servicio y fechas locales con horario de verano.
- `worker/security.ts`: firma, cifrado y rate limiting.
- `worker/eleven.ts`: definiciones de herramientas, prompt, publicación de conocimiento y agente dedicado.
- `migrations/`: SQLite/D1, triggers contra colisiones y operaciones pendientes por sesión.
- `src/main.tsx`: dashboard; `src/VoiceDialog.tsx`: SDK de voz cargado por separado.
- Taller: `src/StudioOrders.tsx`, migración 0006, endpoints `/api/work-orders` y tool `get_my_work_orders`.
- Tipos de agente: `worker/profile.ts` lista las tools permitidas; `worker/index.ts` y `worker/eleven.ts` la aplican. No se genera en recepción.
- Captura (calificador y encuesta): `worker/captures.ts`, `src/StudioCaptures.tsx`, migración 0008, endpoints `/api/captures` y tool `save_capture`.
- En el kit: `tools/verticals.mjs` registra negocios y `tools/profiles.mjs` tipos de agente. Un negocio nuevo necesita su entrada, `presets/<id>.json`, `prompts/<id>.md` y un escenario en `evaluations/policy-cases.json`.

Las tools reciben X-Tools-Key y X-Session-Token. El servidor deriva el propietario de la sesión; nunca acepta identidad declarada por el modelo. La búsqueda devuelve un slot_id opaco que se prepara; commit solo ocurre tras aceptación y devuelve el resultado persistido. Ante timeout consulta el estado. La fecha hablada proviene del servidor, no de conversiones del modelo.

Frontend y API se despliegan en un mismo Worker. La voz necesita HTTPS público y la misma DB de sesiones que reciben las tools. Los documentos se publican explícitamente; un borrador guardado no modifica el agente activo.

Consulta las fuentes oficiales si cambian APIs: [D1](https://developers.cloudflare.com/d1/wrangler-commands/) y [ElevenLabs webhook tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/webhook-tools). Verifica voces y modelos en la cuenta propia; no fijes una voz compartida ajena como requisito.
