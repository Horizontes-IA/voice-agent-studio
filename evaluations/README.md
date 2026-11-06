# Calidad del agente

Prueba en tres capas: herramientas deterministas, conversación simulada y voz real con el negocio. El dashboard funcionando no demuestra las tres.

## Herramientas y permisos

`node --test tests/*.test.mjs` comprueba generador, roles, JWT firmado, proveedor de identidad, CRM y outbox. `node tools/validate-projects.mjs` genera y construye una copia por cada negocio, una production, seis corridas de tipos de agente y una configuración con domingos, tres recursos y zona europea, y ejecuta las regresiones de agenda por preset; instala dependencias si hace falta, usa solo D1 local y guarda resultados en `.validation/`. No ejecuta telefonía, SMS o CRM reales.

## Conversación con ElevenLabs

Los escenarios de `policy-cases.json` incluyen privacidad, envíos inexistentes, los límites de cada negocio, cada tipo de agente, fechas ambiguas, detención antes de confirmar, fallo de catálogo, paquetes y estado de órdenes. El runner elige los que aplican al negocio y al tipo de agente.

```sh
node tools/evaluate-eleven.mjs --project ../mi-demo --agent-id mi-agente
```

Este comando prepara un plan. Para crear y ejecutar simulaciones, configura ELEVENLABS_API_KEY de forma privada y agrega `--run`. Los resultados quedan en `.secrets/policy-evals` del proyecto, con permisos privados. Usa el agente publicado por el mismo proyecto; el runner rechaza agentes de otro negocio. se aplica el prompt del proyecto como override de la prueba y no se publica sobre el agente existente. Todas las tools se simulan y los mocks ausentes generan error: el runner no permite acciones reales.

Usa los endpoints actuales `agent-testing/create` y `agents/:id/run-tests`; no depende de simulate-conversation, cuya retirada está anunciada por ElevenLabs. Una ejecución crea pruebas dedicadas y consume créditos del proveedor. El runner guarda el estado antes de cada escritura y no repite automáticamente una creación incierta. Vuelve a ejecutar el mismo comando para consultar el resultado de una invocación ya iniciada.

Los jueces de simulación pueden equivocarse. Revisa las respuestas y llamadas a herramientas antes de aceptar un PASS. Un escenario de error sin confirmación falsa no prueba que la reserva correcta funcione: eso lo cubren las pruebas de backend y la aceptación real.

## Voz y aceptación del negocio

Desde tu despliegue HTTPS comprueba nombres, interrupciones, fechas, latencia, una reserva, un cambio, una cancelación y una excepción. El teléfono/SMS o CRM de una cuenta no certifica otras cuentas. Completa `materials/business/04-entrega.md` con evidencia y aprobación del responsable. Conserva NOT_RUN para lo que no ejecutaste.

## Recorrido HTTP de production

```sh
node tools/production-http.mjs --project ../piloto-cliente
```

Usa una DB SQLite/D1 temporal de Miniflare, JWT firmado de prueba y dobles de proveedores externos. Comprueba acceso positivo por rol, OTP aprobado/rechazado, sesión de cliente, reserva/cambio/cancelación por tools, solicitud → outbox → contacto/tarea de CRM, auditoría y cierre de sesión. No conecta cuentas reales, no envía SMS y no modifica la DB del proyecto.

## SDK, audio y herramientas reales

```sh
node tools/voice-smoke.mjs --project ../mi-demo --origin https://tu-worker.workers.dev --move
```

Requiere Chrome y un proyecto demo propio publicado. Usa ElevenLabs real, audio TTS real y tools reales del Worker; crea y cancela citas sintéticas. Las peticiones entran por texto dentro de la sesión de voz, con micrófono simulado. Comprueba persistencia en la misma cita y duración/buffer. El informe distingue esta prueba de ASR y aceptación humana. No ejecutes este runner sobre una instalación con datos reales.
