---
name: cotizar-agente
description: Cotizar un agente de voz para un cliente con implementación, mensualidad, minutos incluidos y desglose de costos por minuto, usando el cotizador y la calculadora de Voice Agent Studio. Usar cuando pidan cuánto cobrar por un agente de voz, una cotización, un presupuesto, el costo por minuto o la mensualidad.
---

# Cotizar agente

Convierte volumen y tarifas comprobadas en una cotización con dos partes: lo que ve el cliente y el desglose interno que explica de dónde sale cada cifra.

## Antes de calcular

Localiza el kit: lee `kit-path.txt`, junto a este SKILL.md. Si no existe, busca `tools/cotizar.mjs` y `materials/business/calculadora.html`; si tampoco están, pide la ruta del repositorio.

Pide lo que falte, en un solo mensaje:

- **Volumen:** conversaciones que atenderá el agente al mes, no las llamadas perdidas. Confirma el alcance: si contesta todas, son las llamadas totales; si solo cubre las que hoy se pierden, son esas. Si ya corriste `valorar-negocio`, toma de ahí las llamadas.
- **Duración:** minutos promedio por conversación. No sale de la valoración: mídela en el registro de llamadas o en una demo, o escribe en `fuente_costos` que es un supuesto.
- **Moneda:** la que usarás para cobrarle al cliente. Las tarifas de los proveedores suelen estar en dólares: conviértelas con un tipo de cambio confirmado, anótalo en `fuente_costos` y usa una sola moneda en todo el archivo.
- **Tarifas por minuto:** voz, modelo y telefonía. Telefonía va en 0 si el agente atiende por navegador.
- **Fijos:** infraestructura, CRM y lo que se pague igual sin llamadas.
- **Variables:** verificación, mensajes y otros consumos que no dependan de los minutos.
- **Tu operación:** horas al mes incluidas y tu costo interno por hora.
- **Tus reglas:** contingencia, margen bruto objetivo e implementación.

**Nunca escribas una tarifa de memoria.** Los precios de los proveedores cambian y dependen del plan. Pide al usuario que los confirme en la página de precios de cada proveedor o en su factura, y escribe en `fuente_costos` de dónde salieron. Si solo quiere un ejercicio, escribe ahí "supuesto sin verificar" y dilo al entregar.

## Calcular

1. Crea `cotizacion.json` en la carpeta del proyecto del cliente, no dentro del kit:

   ```json
   {
     "cliente": "Negocio de ejemplo",
     "moneda": "USD",
     "fuente_costos": "Supuesto sin verificar",
     "conversaciones": 600,
     "minutos_por_conversacion": 3,
     "costo_voz_minuto": 0.1,
     "costo_modelo_minuto": 0.02,
     "costo_telefonia_minuto": 0,
     "fijos": 25,
     "variables": 20,
     "horas_operacion": 2,
     "costo_hora": 30,
     "contingencia_pct": 20,
     "margen_pct": 40,
     "implementacion": 2500
   }
   ```

   Las cifras de este ejemplo son hipotéticas. Sustitúyelas todas.

2. Desde el kit: `node tools/cotizar.mjs --input /ruta/cotizacion.json --out /ruta/cotizacion.md`. Si falta un dato, el comando se detiene y lo nombra: pregúntalo, no lo rellenes.
3. Para ajustar cifras en vivo con el dueño, abre `materials/business/calculadora.html` en el navegador. Trabaja en USD; con los mismos datos da el mismo resultado.
4. Antes de enviar, separa las partes: el cliente recibe solo "Para el cliente". El desglose es interno.
5. Vuelve a `valorar-negocio` con la mensualidad y la implementación, en la misma moneda de la valoración, para saber cuántas citas pagan el agente.

## Cómo explicar la cotización

- **Implementación** es un pago único por construir y probar. **Mensualidad** cubre consumo, infraestructura y tu operación.
- **Minutos incluidos** salen del volumen de la cotización. **Minuto adicional** protege tu margen si llaman más de lo previsto: define cómo se avisa al cliente.
- Margen no es recargo: un margen de 40% divide el costo entre 0.6.
- Si el cliente paga directamente a los proveedores, pon esos costos en 0 y dilo por escrito.
- La línea más cara suele ser la voz. Para bajar el costo, compara primero la duración de las llamadas y el plan del proveedor.

## Si necesitas otra línea

Súmala a `fijos` o `variables`. Si se repetirá en cada cotización, añade el campo en `tools/cotizar.mjs` y en la calculadora con la misma fórmula, y ejecuta `npm test` en el kit: una prueba compara los dos cálculos.

## Límites

No incluye impuestos, adquisición de clientes ni costos que no se capturaron. La cotización no es una tarifa oficial de ningún proveedor y no promete ahorros. El kit no incluye telefonía: si la cotizas, usa `conectar-telefono` y cuéntala como trabajo aparte. Para el documento completo usa `propuesta-cliente`.
