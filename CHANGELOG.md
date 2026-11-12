# Cambios

## 1.3.3

- Módulo opcional de Google Calendar vía Composio: cada cita confirmada, ya sea por voz o desde el dashboard, crea su evento en un calendario; si la cita se mueve o se cancela, el evento se actualiza o se borra. La agenda oficial sigue siendo D1: el calendario es un reflejo de un solo sentido. Archivos: `modules/calendar.ts.txt` y `modules/calendar.sql`.
- Guía `skills/voice-agent-studio/references/conectar-calendario.md`: la clave de proyecto de Composio y sus permisos, el enlace para que el cliente autorice su calendario, qué conexiones no sirven desde un Worker y cómo probarlo.
- El módulo no se incluye en los proyectos generados: no cambia las plantillas ni los hashes de `worker/policy.ts` y `worker/eleven.ts`.
- Probado en una demo de estética con una llamada real. Mover y cancelar solo se probaron en local. Sin probar en otras plantillas ni en modo production.

## 1.3.2

- `npm run deploy:guided` ya no falla al iniciar sesión justo después de subir los secretos: espera y reintenta.
- La documentación nombra la pestaña real del dashboard: **Agente de voz → Conexiones**.
- `conectar-telefono` agrega el camino con Twilio CLI: iniciar sesión sin pasar datos por el chat, buscar y comprar un número con OK explícito.

## 1.3.1

- `npm run install-skills` instala los 12 skills en Claude Code y Codex, y guarda en cada uno la ruta del kit. Los skills leen esa ruta antes de pedirla.
- `AGENTS.md` y `CLAUDE.md`: instrucciones para la IA que instala el kit o crea la primera demo.
- `npm run check` reconoce la raíz del kit y dice qué sigue, en vez de marcar fallas de un proyecto generado.
- El repositorio pasa a ser público. `USO.md` y los demás textos lo reflejan, y `materials/launch` queda fuera del paquete.

## 1.3.0

- Doce negocios nuevos: nutrición, psicología, pediatría, laboratorio, óptica, spa, gimnasio, taller de motos, seguros, contabilidad, escuela de manejo y salón de eventos. Cada uno trae preset, política de sector, conocimiento y un escenario de simulación. El kit suma 21 plantillas.
- Ocho skills nuevos: `valorar-negocio`, `cotizar-agente`, `dashboard-a-medida`, `plantilla-nueva`, `analizar-llamadas`, `conectar-telefono`, `propuesta-cliente` y `entrega-cliente`. El kit suma 12.
- `tools/cotizar.mjs` y calculadora con desglose por minuto de voz, modelo y telefonía, minutos incluidos y minuto adicional. Con los valores de ejemplo da el mismo resultado que la 1.2.
- `tools/valorar.mjs` y `materials/business/valoracion.html`: cuántas citas pagan el agente y escenarios de ROI. No trae cifras por defecto.
- `tools/reporte-llamadas.mjs`: reporte mensual con conteos, sin nombres, teléfonos ni transcripciones.
- Las plantillas sin voz probada ya no dicen "español mexicano" en el prompt base, usan su propio icono en el dashboard y no muestran textos clínicos si el negocio no es de salud.
- Las pruebas fijan la suma SHA-256 de `worker/policy.ts` y `worker/eleven.ts` generados en dental, estética y taller con recepción.

### Decisiones

No se añadieron restaurante ni hotel. El motor reserva una persona y un recurso por tiempo fijo: no maneja mesas con cupo ni noches de hospedaje, y una plantilla habría simulado disponibilidad. Esos negocios pueden usar el tipo informativo con `plantilla-nueva`.

### Pendiente

Los doce negocios nuevos no se han probado con voz real de ElevenLabs. `conectar-telefono` es una guía sin probar: el kit sigue atendiendo por navegador. Los skills nuevos no se han invocado como comando en Claude Code ni en Codex.

### Si ya usaste 1.2.0

Actualizar este repositorio no modifica proyectos ya generados. Genera una carpeta nueva si quieres una plantilla nueva.

## 1.2.0

- Seis negocios nuevos: veterinaria, fisioterapia, inmobiliaria, despacho, barbería y academia. Cada uno trae preset, política de sector, conocimiento y un escenario de simulación.
- Tres tipos de agente nuevos con `agent.profile`: informativo, calificador y encuesta. El servidor rechaza las herramientas que no pertenecen a cada tipo.
- Calificador y encuesta guardan respuestas en una página del dashboard; las preguntas se configuran en `agent.capture`.
- Tres skills nuevos: `agente-informativo`, `agente-calificador` y `agente-encuesta`, con instrucciones para Claude Code y Codex.
- Portal y calculadora en la paleta de marca.
- Dental, estética y taller con recepción conservan el mismo prompt y las mismas herramientas de la 1.1: la evidencia de voz real sigue aplicando.

### Pendiente

Los seis negocios y los tres tipos nuevos no se han probado con voz real de ElevenLabs. Los tipos nuevos solo funcionan en modo demo y no hacen llamadas salientes.

## 1.1.0

- Arranque guiado con `npm run start`: datos del negocio, instalación, secretos, D1 local y compilación.
- Despliegue guiado de instalaciones nuevas: nombres libres, D1 propia, migraciones, HTTPS, secretos y publicación opcional de agente. Estado privado para reanudar sin crear recursos a ciegas.
- Agenda configurable: 1–20 recursos, domingos, turnos partidos, cierres, zona IANA, moneda, recursos por servicio y plazos. Fechas con cambios de horario de verano verificadas.
- Conocimiento de negocio, catálogo, equipo y política generado desde la misma configuración.
- Regresiones que derivan fecha y hora de las reglas del negocio; instalación adicional de QA con tres recursos, domingos y zona europea.
- Prueba reproducible de SDK/audio real de ElevenLabs y tools del Worker: reserva/cambio/cancelación y órdenes propias. Entrada escrita; ASR humano pendiente.
- Recorrido positivo de production con D1 local y proveedores simulados: JWT, roles, OTP, sesión propia, agenda, outbox de CRM, auditoría y revocación.
- Simulaciones por sector que exigen el agente del mismo negocio. El escenario de fecha ambigua dispone de catálogo; ya no confunde aclaración con caída del proveedor.
- CI del kit para las regresiones locales. Las simulaciones y voz real se ejecutan aparte con cuentas autorizadas.

### Si ya usaste 1.0.0

Actualizar este repositorio no modifica proyectos previamente generados ni sus DB/agentes. Copia y revisa tu configuración, genera una carpeta nueva y valida sus procesos. Para migrar una instalación con datos, prepara una migración explícita y conserva respaldo. No cambies una DB de demo a production.

HubSpot, Twilio y Access reales siguen requiriendo la aceptación de cada cuenta. Reconocimiento de voz, interrupciones y protocolos requieren conversaciones habladas con usuarios del negocio. Esta versión no añade telefonía, WhatsApp, pagos ni un conector de calendario externo.

## 1.0.0

Generador de tres sectores, dashboard, herramientas de agenda, skill, prompts, candidato production y materiales de propuesta, taller y entrega.
