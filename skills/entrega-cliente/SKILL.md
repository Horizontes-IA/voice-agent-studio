---
name: entrega-cliente
description: Preparar la aceptación y entrega de un agente de voz de Voice Agent Studio a un cliente, con pruebas PASS, FAIL o NOT_RUN, evidencia, documentación y responsables. Usar cuando pidan entregar un proyecto, cerrar un piloto, llenar la matriz de pruebas o preparar el traspaso al cliente.
---

# Entrega al cliente

Deja al cliente un proyecto comprobado y sabiendo qué falta. La regla: cada prueba dice lo que de verdad pasó.

## Comprueba el proyecto

La ruta del kit está en `kit-path.txt`, junto a este SKILL.md; si no existe, pídela. Trabaja en el proyecto del cliente y copia `materials/business/04-entrega.md` del kit a su carpeta.

1. Ejecuta y guarda el resultado: `npm run doctor`, `npm run build`, y con `npm run preview` encendido, `npm test` y `npx playwright test`. Hazlo contra un entorno con datos de prueba, nunca sobre datos reales.
2. Si el tipo de agente no es recepción, desde el kit ejecuta `node tools/check-profile.mjs --project /ruta/proyecto`. Con informativo y encuesta `npm test` no aplica: reserva con tools que esos tipos no tienen.
3. En modo production ejecuta `npm run production:check`. Si falla, muestra lo que falta y no cambies `BUSINESS_APPROVED`.
4. Para voz real en un demo aislado publicado: `node tools/voice-smoke.mjs --project /ruta/proyecto --origin https://URL --move`. Usa la cuenta del cliente, consume créditos y necesita su permiso. No prueba el reconocimiento del micrófono: eso requiere personas hablando.

## Llena la matriz

Marca cada fila:

- **PASS:** la ejecutaste y tienes evidencia, como un comando con resultado, una captura o un ID.
- **FAIL:** la ejecutaste y falló. Anota el impacto.
- **NOT_RUN:** no se ejecutó. Nunca se convierte en PASS porque el código compile.

Actualiza también `testsExecuted` y `stage` en `implementation-report.json`. Cada resultado aplica a esta cuenta y esta instalación.

## Arma el paquete

- URL y repositorio privado del proyecto adaptado.
- Quién es dueño de cada cuenta: Cloudflare, ElevenLabs y las demás.
- Instrucciones para cambiar conocimiento, publicar, pausar el agente y recuperar.
- Pruebas con evidencia, defectos pendientes y su impacto.
- Consumo inicial y quién lo revisa. Usa `analizar-llamadas` para el reporte mensual.
- Alcance del mantenimiento según `materials/business/05-operacion.md`.
- Acta de capacitación y aceptación.

## Revisa antes de entregar

- No hay secretos en el repositorio: revisa `git status` y confirma que `.secrets/`, `.dev.vars` y `.env*` están ignorados. Las contraseñas se entregan por un canal privado, nunca en el documento.
- No quedan datos ficticios en una instalación real, ni identidades de demo.
- Cada recurso es del cliente: DB, agente y secretos propios.
- El kit completo no va al cliente. Entrega solo su proyecto, en un repositorio privado, como indica `USO.md`.

## Límites

No declares "listo para producción" por tu cuenta: lo acepta el responsable del negocio, con nombre y fecha. Telefonía, WhatsApp, pagos y transferencia en vivo van como pendientes, salvo que se hayan construido y probado. Este skill prepara documentos; el usuario decide cuándo enviarlos.
