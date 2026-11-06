---
name: agente-informativo
description: Crear con Voice Agent Studio un agente de voz que solo informa, responde dudas con el conocimiento del negocio y deja solicitudes al equipo, sin tocar la agenda. Usar cuando pidan un agente de preguntas frecuentes, de información o de atención que no reserve citas.
---

# Agente informativo

Construye un agente de voz que responde dudas y deja solicitudes al equipo. No ve la agenda ni datos de personas: el servidor rechaza esas herramientas aunque el modelo intente usarlas.

Conviene cuando el negocio aún no quiere automatizar su agenda, o cuando el problema real son las preguntas repetidas.

## Antes de generar

Localiza el kit: lee `kit-path.txt`, junto a este SKILL.md. Si no existe, busca `tools/create-project.mjs` y `presets/`; si tampoco están, pide la ruta del repositorio. No inventes una plantilla. Lee `README.md` y `skills/voice-agent-studio/references/configuration.md` del kit.

Reúne lo que falte, en un solo mensaje: tipo de negocio, nombre, ciudad, servicios con precio, horario general, las diez preguntas que más reciben con su respuesta aprobada y quién atiende las solicitudes. Si piden una demo, avanza con datos ficticios marcados como tales.

## Generar

1. Copia el preset más parecido de `presets/`. La plantilla `garage` no admite este tipo de agente. Si el negocio no tiene plantilla, parte de la más parecida y escribe sus reglas en `agent.sectorPolicy`; si no, heredará las de esa plantilla, como "solo el fisioterapeuta decide". Cambia también `knowledge`, los IDs y los `resources`.
2. Pon `"profile": "informativo"` dentro de `agent` y escribe las respuestas aprobadas en `knowledge`, con IDs propios. Los IDs `kb-business`, `kb-services`, `kb-team` y `kb-policies` los genera el kit.
3. Genera en una carpeta nueva: `node tools/create-project.mjs --config /ruta/negocio.json --out /ruta/nueva`.
4. En el proyecto: `npm ci`, `npm run setup`, `npm run db:local`, `npm run build`, `npm run preview`.

## Comprobar

Registra cada punto como PASS, FAIL o NOT_RUN, con su evidencia:

- Con `npm run preview` encendido, `node tools/check-profile.mjs --project /ruta/nueva` comprueba desde el kit que las tools publicadas sean las correctas y que el servidor rechace las demás.
- Una pregunta de la knowledge base se responde con la información aprobada.
- Una pregunta sin respuesta no se inventa: ofrece dejar una solicitud.
- Una petición de cita no termina en "quedó agendada": queda como solicitud visible en el dashboard.
- Voz real: publica en tu cuenta y prueba hablando. Compilar no demuestra que la voz funciona.

`node tools/evaluate-eleven.mjs --project /ruta/nueva --agent-id ID` prepara las simulaciones; agregar `--run` consume créditos de tu cuenta de ElevenLabs. `tools/voice-smoke.mjs` no aplica aquí porque reserva citas.

## Límites

Solo modo demo y voz en el navegador. No hay telefonía, WhatsApp ni transferencia en vivo, y una solicitud registrada no es una respuesta inmediata. No lo presentes como listo para atender personas reales.
