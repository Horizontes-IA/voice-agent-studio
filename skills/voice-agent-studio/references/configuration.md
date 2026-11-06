# Configuración del generador · v1.3

Parte de un preset completo. Puedes cambiar los IDs de profesionales y servicios, sin repetirlos. `schemaVersion: 1`; `kind`: dental, salon, garage, veterinaria, fisioterapia, inmobiliaria, despacho, barberia, academia, nutricion, psicologia, pediatria, laboratorio, optica, spa, gimnasio, motos, seguros, contabilidad, manejo o eventos; `slug`: 3–46 caracteres, comienza por letra, solo minúsculas, números y guiones. El slug identifica un Worker y D1 propios: el asistente rechaza nombres ocupados.

`name`, `city` y `agent.name`: texto simple sin caracteres de código. `agent.instructions` define estilo y detalles del negocio dentro de las reglas obligatorias. `agent.sectorPolicy` (opcional, 20–3000 caracteres) reemplaza las reglas de `prompts/<kind>.md`: úsalo cuando tu negocio no tiene plantilla, para que no herede los límites de otro sector. `timezone`: zona IANA válida, como America/Monterrey, America/Bogota o Europe/Copenhagen. `currency`: código ISO admitido, MXN por defecto.

## Agenda configurable

Estos campos son opcionales; el generador guarda sus valores normalizados:

```json
{
  "timezone": "Europe/Copenhagen",
  "currency": "DKK",
  "resources": [
    {"id": 1, "name": "Cabina A"},
    {"id": 2, "name": "Cabina B"},
    {"id": 3, "name": "Cabina C"}
  ],
  "openingHours": {
    "0": [["08:00", "13:00"]],
    "1": [["07:00", "12:00"], ["14:00", "22:00"]],
    "2": [["07:00", "22:00"]],
    "3": [["07:00", "22:00"]],
    "4": [["07:00", "22:00"]],
    "5": [["07:00", "22:00"]],
    "6": []
  },
  "closures": ["2026-12-25"],
  "booking": {"slotMinutes": 10, "maxAdvanceDays": 90, "cancellationHours": 12}
}
```

Días 0–6, domingo=0. Un día omitido o vacío está cerrado. Los intervalos del mismo día deben estar ordenados, sin superposición y alineados con slotMinutes. Se admite 24:00 como fin; para un turno que cruza medianoche define un intervalo en cada día. Cierres específicos anulan todos los turnos de esa fecha.

`resources`: 1–20 recursos con IDs enteros consecutivos desde 1. `booking.slotMinutes`: 5, 10, 15, 20, 30 o 60; `maxAdvanceDays`: 1–365; `cancellationHours`: 0–720. El valor por defecto es 15/90/24.

`providers`: id, name, specialty, initials, color hexadecimal y campos compatibles con la plantilla (`weekdays`, `start_hour`, `end_hour`). Días sin duplicados 0–6; horas enteras entre 0 y 24. Opcionalmente agrega `schedule` con el mismo formato de openingHours para horarios partidos. `schedule` tiene prioridad sobre los campos heredados. La agenda usa la intersección del horario general y el del profesional.

`services`: id, name, specialty, duration (5–480 min, múltiplo de 5), buffer (0–120 min), price numérico no negativo o null y description. `resource_ids` opcional limita recursos compatibles; por defecto incluye todos. Cada servicio debe caber en al menos un turno de un profesional compatible, incluyendo el buffer. Un paquete ocupa una sola persona y recurso durante toda su duración; procesos con varios especialistas consecutivos necesitan otro planificador.

## Tipo de agente

`agent.profile` es opcional: `recepcion` (por defecto), `informativo`, `calificador` o `encuesta`. Los tres últimos solo admiten modo demo y no están disponibles con `kind: garage`. El servidor rechaza las herramientas que no pertenecen al tipo elegido.

Calificador y encuesta guardan respuestas. Sus preguntas son opcionales y van en `agent.capture`; si no las defines se usan unas por defecto:

```json
{
  "agent": {
    "name": "Renata",
    "instructions": "Habla con frases breves y haz una pregunta a la vez.",
    "profile": "calificador",
    "capture": {
      "lead": {
        "title": "Prospectos",
        "fields": [
          {"id": "zona", "label": "Zona que busca", "type": "text", "required": true},
          {"id": "operacion", "label": "Quiere comprar o rentar", "type": "choice", "options": ["comprar", "rentar"], "required": true},
          {"id": "temperatura", "label": "Interés", "type": "choice", "options": ["caliente", "tibio", "frio"], "required": true}
        ]
      }
    }
  }
}
```

Usa `lead` para calificador y `survey` para encuesta. Cada formulario lleva `title` y de 1 a 12 `fields`, con al menos uno obligatorio. `id`: minúsculas, números y guion bajo; `summary` está reservado. `type`: `text`, `choice` con 2–8 `options`, o `score` de 0 a 10. `samples` es opcional: hasta 3 ejemplos con `summary` y `answers` para que la página no se vea vacía en la demo. La herramienta también exige `summary`, un resumen breve que el agente escribe. En calificador, una persona puede negarse a contestar y se guarda `no_respondio`. El servidor valida cada respuesta y una misma conversación actualiza su registro en vez de duplicarlo.

## Conocimiento y cambios

`knowledge`: documentos con id, title, category y content. No incluyas expedientes ni datos privados. Los IDs `kb-business`, `kb-services`, `kb-team` y `kb-policies` están reservados: al generar, su contenido se deriva de nombre, modo, horarios, catálogo y políticas para evitar contradicciones. Usa otros IDs para dirección aprobada, FAQ y protocolos propios. Los precios y disponibilidad vigentes provienen de las tools.

La configuración se valida antes de copiar archivos. El destino debe ser nuevo. Para cambiar una instalación que ya tiene datos, diseña una migración que mantenga coherencia entre catálogo/DB, configuración compilada y conocimiento publicado. Modificar el JSON y volver a desplegar no migra el catálogo existente. Para practicar otra configuración, genera una instalación nueva.

Las regresiones de cambio/cancelación necesitan una ventana futura con anticipación suficiente respecto a la política. Una configuración con horizonte de un día y cancelación de 24 horas puede ser válida para operar, pero no deja espacio para ese escenario de QA: usa una instalación de pruebas adecuada y reporta lo que realmente ejecutaste.
