---
name: propuesta-cliente
description: Redactar la propuesta de implementación de un agente de voz para un cliente a partir del descubrimiento, la demo, la valoración y la cotización de Voice Agent Studio. Usar cuando pidan una propuesta, un alcance, un documento para el cliente o preparar el cierre de un piloto.
---

# Propuesta al cliente

Convierte lo que ya se sabe del negocio en una propuesta con alcance, entregables, inversión y aceptación. Solo lleva lo que se puede sostener.

## Reúne lo que existe

Localiza el kit (lee `kit-path.txt`, junto a este SKILL.md; si no existe, pide la ruta del repositorio) y trabaja sobre una copia de `materials/business/03-propuesta.md` en la carpeta del cliente. Busca:

- **Descubrimiento:** la ficha de `materials/business/01-descubrimiento.md`.
- **Demo:** proyecto generado, tipo de agente y pruebas hechas, según su `implementation-report.json`.
- **Valoración:** resultado de `valorar-negocio`, si existe.
- **Cotización:** resultado de `cotizar-agente`. Usa solo la parte "Para el cliente".

Si falta la cotización o quién aprueba, pregúntalo antes de redactar. No rellenes con ejemplos genéricos.

## Redactar

1. **Problema y resultado:** usa las palabras del dueño y una métrica medible. Si la métrica aún no se midió, escribe que se medirá al inicio del piloto.
2. **Incluido:** un negocio, un canal, un catálogo. Lista cada integración con su dirección de sincronización y quién da acceso.
3. **Entregables y aceptación:** conserva la tabla y ajusta evidencia y responsable a este cliente.
4. **Inversión:** implementación, mensualidad, minutos incluidos, minuto adicional y quién paga a los proveedores.
5. **Fuera de alcance:** escríbelo completo. El kit no incluye telefonía, WhatsApp, SMS de recordatorio, pagos, transferencia en vivo ni conectores de calendario externo. Si el cliente los necesita, se construyen y se prueban como trabajo aparte.
6. **Limpia el documento:** borra los corchetes, las instrucciones y las notas internas de la plantilla, incluida la de precios mínimos de otra persona. Revisa que no quede ningún `[`.

## Lo que no puede decir

- Que el agente está listo para producción. La propuesta describe un piloto con pruebas.
- Que se probó con voz real, salvo que tengas esa evidencia para esa plantilla. Solo dental, estética y taller con recepción la tienen en el kit, y no certifica la cuenta del cliente.
- Promesas de clientes, ingresos o ahorro. Si citas la valoración, nombra el origen de las cifras y llámala estimación.
- Certificaciones legales o de salud. Las condiciones finales se formalizan por separado.

## Entregar

Muestra el borrador al usuario y señala cada supuesto. Él decide el envío: este skill no manda nada. Para el cierre usa `entrega-cliente`.
