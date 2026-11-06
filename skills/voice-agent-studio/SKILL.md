---
name: voice-agent-studio
description: Adaptar Voice Agent Studio a un negocio con ElevenLabs Agents, dashboard y Cloudflare. Usar para generar una demo de recepción desde cualquiera de sus 21 plantillas, como dental, estética, taller, pediatría, spa o gimnasio, y preparar sus pruebas.
---

# Voice Agent Studio

Construye una demo específica y comprobable desde el kit. El kit contiene código, un generador y 21 plantillas: dental, salon (estética), garage (taller), veterinaria, fisioterapia, inmobiliaria, despacho, barberia, academia, nutricion, psicologia, pediatria, laboratorio, optica, spa, gimnasio, motos, seguros, contabilidad, manejo y eventos. Este skill construye el agente de recepción. Si piden un agente que solo informe, que califique prospectos o que haga encuestas, usa `agente-informativo`, `agente-calificador` o `agente-encuesta`. Para un negocio sin plantilla usa `plantilla-nueva`.

## Localizar el kit y elegir el alcance

Lee `kit-path.txt`, junto a este SKILL.md: ahí está la ruta del kit. Si no existe, localiza `tools/create-project.mjs` y `presets/` en el repositorio del usuario o en la raíz del kit, dos niveles por encima de este skill. Si tampoco están, solicita la ruta del repositorio: no inventes ni descargues una plantilla diferente. Lee el README del kit y [la arquitectura](references/architecture.md) al adaptar código.

Recoge los datos que aún no estén en el contexto: tipo de negocio, nombre, ciudad, catálogo con duraciones y buffers, profesionales y especialidades, horarios, política de cambios, preguntas frecuentes y casos que debe resolver una persona. Agrupa preguntas y avanza con datos ficticios claramente identificados si el usuario pide una demo.

Escoge el preset que corresponde al proceso. Si el negocio no tiene plantilla, parte de la más parecida y escribe sus reglas en `agent.sectorPolicy` para que no herede las de otro sector. Si el negocio necesita funciones fuera del motor, identifica el cambio y su prueba antes de prometerlo. El motor admite 1–20 recursos, horarios por día incluidos domingos, turnos partidos por profesional, cierres, zonas IANA y monedas ISO. Cada servicio puede restringir recursos. Intervalo, horizonte y plazo de cambios son configurables. Un paquete de estética usa una sola especialista y un puesto. Las órdenes del taller se leen por propietario de sesión y solo administración las modifica.

## Generar y adaptar

1. Copia el preset a un archivo de configuración del proyecto; usa IDs estables. Consulta [configuración](references/configuration.md). Mantén credenciales fuera del JSON.
2. Para una demostración usa `node tools/create-project.mjs --config /ruta/business.json --out /ruta/nueva`. Para una implementación solicitada por un cliente agrega `--mode production` y lee `production/README.md` del kit: elimina identidades ficticias, exige personal con Access y crea portal con verificación y conector CRM. El generador no sobrescribe destinos existentes, crea recursos remotos ni instala dependencias.
3. En el proyecto: `npm ci`, `npm run setup`, `npm run db:local`, `npm run build`. Inicia `npm run preview` y ejecuta `npm test` en otra terminal. El setup genera secretos privados locales y nunca imprime sus valores.
4. Adapta información y reglas reales sin eliminar comprobaciones de sesión, especialidad, disponibilidad, confirmación explícita o atomicidad. El JSON es una entrada de generación: cambiarlo luego no migra una DB existente. Para una configuración diferente, genera en otra carpeta y conserva el trabajo previo.
5. Prepara el piloto y entrega el reporte de implementación con pruebas realmente ejecutadas, pendientes y resultado observable. Usa [aceptación](references/acceptance.md); no declares voz probada por el hecho de compilar. El kit contiene prompts por sector y un runner `tools/evaluate-eleven.mjs`: prepara primero el plan sin --run; las simulaciones en ElevenLabs con --run consumen la cuenta y crean pruebas dedicadas, con herramientas reales deshabilitadas. Para un proyecto demo aislado publicado usa `node tools/voice-smoke.mjs --project /ruta/demo --origin https://tu-worker.workers.dev --move`. Conecta voz/audio reales y prueba acciones con entradas escritas: no equivale a probar ASR humano. Revisa también conversaciones habladas autorizadas antes de aprobar producción.

## Conectar y entregar

Usa `npm run start` desde el kit para un arranque guiado (también admite --config, --out y --install no). En el proyecto, `npm run deploy:guided` comprueba nombres libres, crea D1 y despliega con progreso privado; production queda bloqueado hasta configurar y validar sus proveedores. El README generado describe la alternativa manual. Cada cliente debe tener sus propios recursos y secretos; no reutilices la DB ni el agente de otra instalación. Sigue el alcance autorizado por el usuario antes de crear recursos externos. No modifiques agentes o webhooks globales de otros proyectos. Recibe claves por variables privadas o campos del dashboard, nunca pidas pegarlas en la conversación.

En modo demo, administración elige la identidad. El modo production implementa Cloudflare Access para personal, roles, portal con Twilio Verify, retención local y outbox de HubSpot; cada cuenta, protocolo y conexión requiere configuración y pruebas antes de activar BUSINESS_APPROVED. El SMS de Verify no equivale a recordatorios. Telefonía, WhatsApp, cobros y transferencia en vivo requieren implementación adicional. Conserva esos límites en la propuesta y reporte. No cambies APP_ENV de una DB de demo para convertirla en una instalación real: genera recursos nuevos.

Para vender y entregar usa los otros skills del kit: `valorar-negocio`, `cotizar-agente`, `propuesta-cliente`, `entrega-cliente`, `dashboard-a-medida`, `analizar-llamadas` y `conectar-telefono`. Separa implementación, costos de proveedores, mantenimiento y funciones pendientes. No prometas clientes, ahorros ni ingresos sin evidencia del negocio.
