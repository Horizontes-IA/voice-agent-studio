---
name: plantilla-nueva
description: Crear un agente de voz en Voice Agent Studio para un negocio que no tiene plantilla, con su propio catálogo, vocabulario y reglas en agent.sectorPolicy, o añadirlo al kit como plantilla permanente. Usar cuando el negocio del cliente no está entre las plantillas, o cuando pidan una plantilla o vertical nueva.
---

# Plantilla nueva

Adapta el generador a un negocio sin plantilla, sin que herede las reglas ni las palabras de otro sector.

## Primero: comprueba que el negocio cabe en el motor

La ruta del kit está en `kit-path.txt`, junto a este SKILL.md; si no existe, pídela. Lee `README.md` y `skills/voice-agent-studio/references/configuration.md` del kit. Cada cita usa **una persona y un recurso durante un tiempo fijo**.

Sí cabe: consultas, sesiones, visitas, clases individuales, servicios por turno.

No cabe sin otro motor:

- Mesas de restaurante con cupo por personas.
- Hospedaje por noches.
- Clases grupales con cupo.
- Procesos con varios especialistas seguidos.

Si la duración varía mucho, como en un tatuaje o una reparación, crea servicios por tamaño o una primera cita de valoración. El motor no admite duraciones abiertas.

Para los negocios que no caben, no fuerces la agenda. Ofrece el tipo `informativo`: responde dudas y deja solicitudes al equipo, sin ver la agenda. Usa `agente-informativo` y escribe el límite en la sección "Fuera de alcance" de la propuesta. El generador igual pide un profesional, un servicio y un recurso: usa `Equipo`, `Atención general` y `Recepción`, y borra los del preset que copiaste, porque el conocimiento los publica. Construir otro motor es un proyecto aparte.

## Camino A: solo para este cliente

Es el camino normal. No toca el kit.

1. Copia de `presets/` la plantilla con el mismo vocabulario, porque `kind` decide las palabras del dashboard:

   | El negocio dice | Copia |
   |---|---|
   | Pacientes y clínica | `fisioterapia` o `nutricion` |
   | Pacientes, sin clínica | `laboratorio` |
   | Clientes | `barberia`, `spa` o `seguros` |
   | Alumnos | `academia` o `manejo` |
   | Socios | `gimnasio` |

2. Conserva `kind` y cambia `slug`, `name`, `city`, `timezone`, `currency`, `agent.name`, `agent.instructions`, `providers`, `services`, `resources`, `knowledge`, `openingHours`, `closures` y `booking`. Solo datos aprobados, o ficticios marcados como tales. Tres trampas:
   - **Horario:** sin `openingHours` se usa lunes a viernes de 9 a 19 y sábado de 9 a 14, sin avisar, y recorta el horario de cada persona. Decláralo siempre.
   - **IDs:** usa IDs nuevos en `providers` y `services`. En `resources` van consecutivos desde 1.
   - **Conocimiento:** conserva los IDs `kb-business`, `kb-services`, `kb-team` y `kb-policies`. Si los renombras, esos documentos no se generan y las pruebas no lo detectan. Reescribe los otros.
3. Escribe sus reglas en `agent.sectorPolicy`, de 20 a 3000 caracteres. **Sin este campo hereda las reglas de la plantilla que copiaste.** Di qué agenda, qué nunca hace y qué pasa a una persona. Si atiende el cuerpo o la salud de alguien, o tienes duda, trátalo como salud: debe negarse a diagnosticar y pedir que acudan a urgencias ante señales de emergencia. El generador no lo valida: lo compruebas tú en el paso 6.
4. Genera: `node tools/create-project.mjs --config /ruta/negocio.json --out /ruta/nueva`.
5. En el proyecto: `npm ci`, `npm run setup`, `npm run db:local`, `npm run build`, `npm run preview`, y en otra terminal `npm test`.
6. Busca palabras ajenas en lo generado. Agrega al `grep` la profesión y los servicios de la plantilla que copiaste, como `barbero|silla`:

   ```sh
   grep -rniE "dental|odont|ortodon|sonrisa|sillón" src worker business.config.json
   ```

   Un resultado vacío no basta. Lee también `worker/policy.ts`, sección "Proceso del sector": debe ser tu `agent.sectorPolicy`. En un negocio de salud, `grep -ci diagnost worker/policy.ts` y `grep -ci urgencia worker/policy.ts` deben dar 1 o más cada uno.

El icono del dashboard viene de `kind`. Para cambiarlo, usa el camino B.

## Camino B: añadirlo al kit

Solo si lo vas a reutilizar para varios clientes. Toca cuatro archivos:

1. `tools/verticals.mjs`: añade la entrada con `label`, `icon` de lucide-react, `process` y `voiceTested: false`. Usa `clinic` y `patients` si conserva esas palabras, `people` para otro nombre, y `health` si es de salud.
2. `presets/<kind>.json`: con los 8 documentos de `knowledge`. Copia un preset y mantén sus IDs.
3. `prompts/<kind>.md`: sus reglas, sin nombrar tools. El mismo texto se usa en todos los tipos de agente.
4. `evaluations/policy-cases.json`: un escenario que ponga a prueba el límite principal de ese negocio.

Después ejecuta `npm test` y `node tools/validate-projects.mjs --only <kind>` en el kit. Actualiza la tabla de negocios de `README.md`, `INICIO.html` y `CHANGELOG.md`; hay pruebas que comparan el conteo.

## Límites

Pasar las pruebas locales no significa que la voz funcione. **No pongas `voiceTested: true` sin una prueba con ElevenLabs real.** Las reglas de salud, legales o financieras las debe revisar el responsable del negocio antes de atender a personas reales.
