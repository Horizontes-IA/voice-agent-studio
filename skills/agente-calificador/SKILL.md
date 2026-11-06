---
name: agente-calificador
description: Crear con Voice Agent Studio un agente de voz que califica prospectos, guarda sus respuestas en el dashboard y puede agendarles una cita. Usar cuando pidan un agente de ventas, un calificador de leads, un agente para inmobiliaria o academia, o algo que filtre interesados antes de pasarlos al equipo.
---

# Agente calificador

Construye un agente de voz que entiende qué busca la persona, guarda sus respuestas en una página del dashboard y, si quiere avanzar, le agenda una cita con el mismo proceso de confirmación de la recepción.

## Antes de generar

Localiza el kit: lee `kit-path.txt`, junto a este SKILL.md. Si no existe, busca `tools/create-project.mjs` y `presets/`; si tampoco están, pide la ruta del repositorio. No inventes una plantilla. Lee `README.md` y `skills/voice-agent-studio/references/configuration.md` del kit.

Reúne lo que falte, en un solo mensaje: tipo de negocio, nombre, ciudad, servicios, equipo, horarios, las preguntas que usa su mejor vendedor para saber si un prospecto vale la pena y qué hace que uno sea caliente, tibio o frío. Si piden una demo, avanza con datos ficticios marcados como tales.

## Generar

1. Copia el preset más parecido de `presets/`. `inmobiliaria` y `academia` ya traen preguntas propias. La plantilla `garage` no admite este tipo de agente. Si el negocio no tiene plantilla, parte de la más parecida y escribe sus reglas en `agent.sectorPolicy`; si no, heredará las de esa plantilla, como "solo el fisioterapeuta decide". Cambia también `knowledge`, los IDs y los `resources`.
2. Pon `"profile": "calificador"` dentro de `agent`, y en `agent.instructions` escribe qué hace que un prospecto de este negocio sea caliente, tibio o frío.
3. Define las preguntas en `agent.capture.lead`: `title` y de 1 a 12 `fields`. Cada campo lleva `id`, `label`, `type` (`text`, `choice` con `options`, o `score`) y `required`. Usa pocas: cada pregunta extra es una razón más para colgar.
4. Genera en una carpeta nueva: `node tools/create-project.mjs --config /ruta/negocio.json --out /ruta/nueva`.
5. En el proyecto: `npm ci`, `npm run setup`, `npm run db:local`, `npm run build`, `npm run preview`.

## Comprobar

Registra cada punto como PASS, FAIL o NOT_RUN, con su evidencia:

- Con `npm run preview` encendido, `node tools/check-profile.mjs --project /ruta/nueva` comprueba desde el kit las tools permitidas, los campos obligatorios, que un reintento no duplique y la página del dashboard. Crea datos de prueba en la base local.
- Abre el dashboard y confirma que la página muestra tus preguntas.
- `npm test` en el proyecto comprueba que preparar una reserva no la confirma. Que el agente pida el "sí" antes de confirmar lo exige su prompt: compruébalo en la conversación.
- Conversación: alguien que solo explora no recibe presión, urgencia falsa ni una cita que no pidió.
- Voz real: publica en tu cuenta y prueba hablando. Compilar no demuestra que la voz funciona.

`node tools/evaluate-eleven.mjs --project /ruta/nueva --agent-id ID` prepara las simulaciones; agregar `--run` consume créditos de tu cuenta de ElevenLabs.

## Límites

Solo modo demo y voz en el navegador. El agente responde a quien entra a hablar con él: no hace llamadas salientes. No envía el prospecto a un CRM; eso requiere implementarlo. La temperatura la decide el modelo con lo que oyó, así que el equipo debe revisarla.
