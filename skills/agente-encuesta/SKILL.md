---
name: agente-encuesta
description: Crear con Voice Agent Studio un agente de voz que hace encuestas de satisfacción después de una visita, guarda las respuestas en el dashboard y avisa al equipo cuando hay una queja. Usar cuando pidan una encuesta por voz, medir satisfacción o NPS, o recoger opiniones de clientes.
---

# Agente de encuesta

Construye un agente de voz que pregunta cómo le fue a la persona, guarda las respuestas en una página del dashboard con su promedio y deja una solicitud al equipo cuando la calificación es baja o hay una queja.

## Antes de generar

Localiza el kit: lee `kit-path.txt`, junto a este SKILL.md. Si no existe, busca `tools/create-project.mjs` y `presets/`; si tampoco están, pide la ruta del repositorio. No inventes una plantilla. Lee `README.md` y `skills/voice-agent-studio/references/configuration.md` del kit.

Reúne lo que falte, en un solo mensaje: tipo de negocio, nombre, ciudad, qué quieren medir y quién atiende las quejas. Si piden una demo, avanza con datos ficticios marcados como tales.

## Generar

1. Copia el preset más parecido de `presets/`. La plantilla `garage` no admite este tipo de agente. Si el negocio no tiene plantilla, parte de la más parecida y escribe sus reglas en `agent.sectorPolicy`; si no, heredará las de esa plantilla, como "solo el fisioterapeuta decide". Cambia también `knowledge`, los IDs y los `resources`.
2. Pon `"profile": "encuesta"` dentro de `agent`.
3. Usa las preguntas incluidas o define las tuyas en `agent.capture.survey`: `title` y de 1 a 12 `fields`, con `id`, `label`, `type` (`text`, `choice` con `options`, o `score` de 0 a 10) y `required`. Con más de cuatro preguntas la gente suele abandonar.
4. Genera en una carpeta nueva: `node tools/create-project.mjs --config /ruta/negocio.json --out /ruta/nueva`.
5. En el proyecto: `npm ci`, `npm run setup`, `npm run db:local`, `npm run build`, `npm run preview`.

## Comprobar

Registra cada punto como PASS, FAIL o NOT_RUN, con su evidencia:

- Con `npm run preview` encendido, `node tools/check-profile.mjs --project /ruta/nueva` comprueba desde el kit las tools permitidas, los campos obligatorios, que una calificación de 11 se rechace, que un reintento no duplique y la página del dashboard. Crea datos de prueba en la base local.
- Abre el dashboard y confirma que la página muestra tus preguntas y su promedio.
- Conversación: una calificación baja no se discute, no se pide cambiarla y no se compensa con descuentos, y genera una solicitud al equipo.
- Voz real: publica en tu cuenta y prueba hablando. Compilar no demuestra que la voz funciona.

`node tools/evaluate-eleven.mjs --project /ruta/nueva --agent-id ID` prepara las simulaciones; agregar `--run` consume créditos de tu cuenta de ElevenLabs. `tools/voice-smoke.mjs` no aplica aquí porque reserva citas.

## Límites

Solo modo demo y voz en el navegador. El agente no llama a nadie: la persona entra a un enlace. Para llamar después de cada visita hay que implementar telefonía, consentimiento y horarios de contacto. Una solicitud registrada no significa que alguien vaya a contactar a la persona de inmediato.
