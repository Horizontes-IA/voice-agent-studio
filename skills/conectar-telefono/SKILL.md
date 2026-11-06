---
name: conectar-telefono
description: Planear e implementar la conexión de un agente de Voice Agent Studio a un número de teléfono con Twilio o SIP en ElevenLabs. Usar cuando pidan que el agente conteste llamadas telefónicas, conectar Twilio, un SIP trunk o un conmutador. Esta conexión no está probada en el kit y requiere desarrollo y pruebas propias.
---

# Conectar teléfono

**Esta conexión no está probada.** El kit atiende por navegador. Nada de este skill se ha ejecutado contra un teléfono real con un proyecto generado, y conectar un número no basta para que funcione. Dilo así al usuario y al cliente, y cotízalo como trabajo aparte.

## Por qué no basta con comprar un número

En el navegador, el dashboard crea una sesión y le pasa `session_token` al agente. Todas las tools del Worker exigen ese token en `X-Session-Token`. Una llamada telefónica no pasa por el dashboard, así que sin más trabajo **cada tool responde con un error de sesión, como `SESSION_REQUIRED`, y el agente no puede consultar ni agendar nada**.

Además, el número que aparece en una llamada no demuestra quién llama. No lo uses para revelar ni cambiar las citas de nadie.

## Decide el alcance

Empieza por el más simple que sirva, y confirma la decisión con el usuario:

| Alcance | Qué hace | Trabajo |
|---|---|---|
| Informativo por teléfono | Responde dudas y deja solicitudes. No ve datos privados | Webhook de sesión, perfil `informativo` |
| Reservas nuevas | Además crea citas sin leer las existentes | Webhook, alta de la persona y cambios de permisos |
| Reservas con identidad | Consulta y cambia citas propias | Verificación real: parte del modo production y su OTP |

## Implementar

Trabaja en el proyecto del cliente y en un entorno de pruebas.

1. **Número.** En ElevenLabs Agents, pestaña Phone Numbers:
   - **Twilio:** importa con Label, Phone Number, Twilio SID y Twilio Token. Prefiere una API key de Twilio con permisos limitados. Un número comprado admite entrada y salida; un caller ID verificado solo salida.
   - **SIP:** Import number, From SIP Trunk. Empieza con TCP o TLS y autenticación digest; UDP es experimental. Revisa puertos, códecs y firewall con quien administra el conmutador.
2. **Webhook de sesión.** Añade en `worker/index.ts` una ruta bajo `/api/webhooks/` que:
   - Compruebe un secreto en un encabezado. Esa ruta se salta la sesión de administración, así que sin este control queda abierta.
   - Reciba `caller_id`, `called_number`, `agent_id`, `call_sid` y `conversation_id`, y rechace un `agent_id` ajeno.
   - Cree una fila en `voice_sessions` con el hash de un token nuevo, `verified` en 0 y una caducidad corta.
   - Responda con `type` igual a `conversation_initiation_client_data` y `dynamic_variables` con todas las variables que usa el agente: `session_token`, `patient_name`, `clinic_date` y `pending_operation_id`.
3. **Actívalo en ElevenLabs.** Registra la URL y el secreto en los ajustes de Agents, y activa la obtención de datos de inicio para llamadas de Twilio en la pestaña Security del agente.
4. **Conversación.** Registra cada llamada en `conversations` con `channel` igual a `phone` y el webhook de fin de llamada para los minutos. Sin esto, el dashboard no la muestra.
5. **Prompt.** Añade reglas de teléfono: aviso de que es un asistente virtual, aviso de grabación si aplica, qué hacer si no entiende y cómo termina. `worker/policy.ts` se genera con la configuración: usa `agent.sectorPolicy` para no perder el cambio.
6. **Atención humana.** El kit no transfiere llamadas: una solicitud queda pendiente en el dashboard. Si el cliente quiere transferir, configúralo y pruébalo con un teléfono real antes de prometerlo.

Los menús de los proveedores cambian: confirma cada paso en la documentación actual de ElevenLabs sobre integración nativa con Twilio, SIP trunking y datos de inicio de conversación.

## Comprobar

Nada de esto se da por hecho. Registra PASS, FAIL o NOT_RUN, con evidencia, en `materials/business/04-entrega.md` del kit (su ruta está en `kit-path.txt`, junto a este SKILL.md):

- Una llamada real entra, el agente responde y llama a una tool con éxito.
- Sin el secreto, el webhook responde 401. Con un `agent_id` ajeno, lo rechaza.
- Una sesión con `verified` en 0 no puede leer ni cambiar citas.
- Latencia aceptable, interrupciones, nombres y acentos con personas reales.
- Señal mala, silencio largo y colgar a la mitad de una reserva.
- La llamada aparece en el dashboard con sus minutos, y el costo coincide con las facturas.

## Costos y legal

Telefonía suma su costo por minuto: ponlo en `costo_telefonia_minuto` de `cotizar-agente`, con la tarifa real de tu proveedor. Revisa con el responsable del negocio el aviso de grabación, el consentimiento y las reglas de llamadas de su país. Las llamadas salientes tienen reglas propias: no las actives sin esa revisión.
