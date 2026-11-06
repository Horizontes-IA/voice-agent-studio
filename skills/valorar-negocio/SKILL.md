---
name: valorar-negocio
description: Valorar antes de vender si un agente de voz le conviene a un negocio, con llamadas perdidas, valor de una cita, citas que pagan el agente y ROI usando cifras que da el dueño. Usar cuando pidan calcular el retorno, cuánto pierde un negocio por no contestar, justificar el precio de un agente o preparar la conversación antes de cotizar.
---

# Valorar negocio

Traduce las llamadas perdidas a dinero con las cifras del dueño y responde una pregunta concreta: cuántas citas tiene que recuperar el agente para pagarse.

**La regla de este skill: nunca inventes una cifra.** Ni promedios de la industria, ni "lo normal en este sector". Si un dato no existe, se pregunta o se mide.

## Antes de calcular

Localiza el kit: lee `kit-path.txt`, junto a este SKILL.md. Si no existe, busca `tools/valorar.mjs` y `materials/business/valoracion.html`; si tampoco están, pide la ruta del repositorio.

Pregunta al dueño, en un solo mensaje, y anota si cada cifra está medida o es su estimación:

1. ¿Cuántas llamadas reciben al mes?
2. ¿Qué porcentaje no se contesta, incluidas las de fuera de horario?
3. De las llamadas que sí se contestan, ¿qué porcentaje termina en cita?
4. ¿Cuánto deja una cita en promedio?
5. ¿Qué margen bruto queda de esa cita, después de costos directos?
6. ¿Quien no logra comunicarse suele volver a llamar? ¿Hay cupo para más citas? Si no hay cupo, recuperar llamadas no da más citas: dilo.

El orden es este: primero valora sin precio, después usa `cotizar-agente` con el volumen, y vuelve aquí con la mensualidad y la implementación.

Si no sabe el volumen o las pérdidas, no avances con supuestos. Propón medir una semana completa y multiplicar por 4.3 para estimar el mes:

- **Mejor:** el registro de llamadas del operador o del conmutador. Incluye las de fuera de horario y permite separar quién volvió a llamar.
- **Si no existe:** una hoja donde recepción marque cada llamada. No ve las de fuera de horario: anótalo en `fuente`.

Usa también `materials/business/01-descubrimiento.md`.

## Calcular

1. Crea `valoracion.json` en la carpeta del proyecto del cliente:

   ```json
   {
     "negocio": "Nombre del negocio",
     "moneda": "MXN",
     "fuente": "Dueño, sin medir",
     "llamadas_mes": 0,
     "perdidas_pct": 0,
     "conversion_pct": 0,
     "valor_cita": 0,
     "margen_pct": 0
   }
   ```

   Sustituye cada valor. Los porcentajes van de 0 a 100: 30 significa 30%. `fuente` debe decir de dónde salió cada dato y si está medido: el documento final lo muestra.

   Cuando tengas la cotización, agrega `mensualidad` e `implementacion` en la misma `moneda`. Si la cotización está en otra, conviértela con un tipo de cambio confirmado y anótalo en `fuente`.

2. Desde el kit: `node tools/valorar.mjs --input /ruta/valoracion.json --out /ruta/valoracion.md`. Si falta un campo o un valor no tiene sentido, el comando se detiene y lo nombra. Nunca pongas un 0 para que pase.
3. Para hacerlo en vivo con el dueño, abre `materials/business/valoracion.html`: empieza vacía a propósito.

## Leer el resultado

Empieza por **las citas que pagan el agente**. No depende de ningún supuesto sobre cuántas llamadas se recuperan, y el dueño puede juzgarlo solo: "¿son realistas 6 citas más al mes?". Presenta el ingreso de las llamadas perdidas como un techo: no todo se puede recuperar.

`recuperable_pct` es opcional y es un supuesto: nadie sabe cuánto se recupera hasta correr un piloto. Si lo usas, pide al dueño el porcentaje que le parezca creíble, muestra varios y llámalos escenarios. Sin ese dato, el ROI no se calcula.

Si el resultado no da, dilo. Un negocio con pocas llamadas perdidas o citas de bajo margen quizá no necesita un agente, y decirlo también vende confianza.

## Límites

Es una estimación con las cifras del negocio. No prometas ingresos ni ahorro: no todas las llamadas perdidas son clientes nuevos y no toda persona quiere hablar con un agente. Para medir el resultado real, compara un periodo de piloto contra uno equivalente previo y usa `analizar-llamadas`.
