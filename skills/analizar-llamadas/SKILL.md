---
name: analizar-llamadas
description: Preparar el reporte mensual para el cliente a partir de las conversaciones, citas y solicitudes de un agente de Voice Agent Studio, sin exponer datos personales. Usar cuando pidan analizar llamadas, un reporte del mes, cómo le fue al agente, cuántas citas agendó o cuánto consumió.
---

# Analizar llamadas

Convierte los datos del agente en un reporte mensual que el cliente pueda entender y comprobar.

## Generar el reporte

Localiza el kit: lee `kit-path.txt`, junto a este SKILL.md. Si no existe, busca `tools/reporte-llamadas.mjs`; si tampoco está, pide la ruta del repositorio. El proyecto del cliente debe tener `node_modules`.

```sh
node tools/reporte-llamadas.mjs --project /ruta/proyecto --month 2026-10 --out /ruta/reporte-2026-10.md
```

- Sin más opciones lee la base local. Para la instalación desplegada agrega `--remote`, con Wrangler autenticado en la cuenta del cliente. Solo hace consultas `SELECT`.
- `--costo-minuto 0.12 --moneda USD` estima el costo de proveedores. Toma la tarifa y su moneda de la cotización o de la factura, no de memoria. Sin `--moneda` usa la del negocio. Sin tarifa, el reporte lo dice.

El reporte trae conversaciones, minutos, llamadas fuera de horario, citas creadas por el agente, solicitudes al equipo y, en calificador o encuesta, prospectos y calificación promedio. Solo conteos.

## Antes de entregarlo

1. **Sincronización:** si el reporte avisa de conversaciones sin sincronizar, sus minutos cuentan como cero. Configura el webhook, o sincronízalas una por una desde la página Conversaciones del dashboard, antes de usar los minutos para facturar.
2. **Cruza una cifra:** compara las citas del agente contra la agenda, y los minutos contra el panel de ElevenLabs. Si no coinciden, investígalo antes de enviar.
3. **Datos de demo:** el reporte avisa si la instalación está en modo demo o si el mes sigue en curso. Las pruebas automáticas también crean citas del agente: un reporte de demo no tiene resultados que entregar.
4. **Solicitudes sin resolver:** avísale al responsable. Son personas esperando respuesta.

## Interpretar

Añade al final, con tus palabras, tres cosas: qué pasó, qué se ajustará y qué necesitas del cliente. Usa `materials/business/05-operacion.md` para los indicadores.

Si necesitas entender por qué pasó algo, revisa una muestra autorizada de resúmenes. Ejecútalo dentro de la carpeta del proyecto; `SLUG` es el de `business.config.json`, y sin despliegue usa `--local`:

```sh
npx wrangler d1 execute SLUG --remote --command "SELECT started_at,duration,summary FROM conversations ORDER BY started_at DESC LIMIT 20"
```

Saca patrones, no citas. Antes de escribir nada en el reporte, quita nombres, teléfonos y cualquier dato de salud, legal o financiero. Si el negocio no autorizó revisar conversaciones, no lo hagas.

## Reglas

- No afirmes un ahorro sin comparar contra un periodo equivalente previo. Un minuto de agente no es un minuto de personal ahorrado.
- No confundas citas preparadas con citas guardadas, ni solicitudes registradas con solicitudes atendidas.
- Con menos de 30 conversaciones, di que la muestra es pequeña. No calcules porcentajes para aparentar una tendencia.
- Nunca incluyas transcripciones completas en un reporte.
- El usuario decide cuándo enviarlo. Este skill no envía nada.
