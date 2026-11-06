# Candidato para piloto con clientes

Esta copia se generó en modo `production`. Incluye código de identidad de personal, verificación de teléfono, sesiones por cliente, prompts versionados y conector HubSpot. **No está aprobada para operar hasta completar las pruebas de esta instalación.** No se cargan personas ni citas sintéticas en este modo.

La fuente oficial de agenda implementada es D1. No hay sincronización con Google Calendar o software dental en este módulo. Si tu cliente usa otra agenda, la integración y reconciliación deben construirse y aprobarse antes de presentar reservas como confirmadas en ese sistema.

## 1. Datos y recursos propios

Genera una carpeta y base nuevas. No conviertas una DB con personas ficticias en DB de producción. El primer acceso de personal autorizado inicializa únicamente catálogo, equipo, conocimiento y configuración del agente. Los clientes se crean desde el portal después de verificar su teléfono. El alta manual del dashboard no habilita identidad por sí sola.

## 2. Acceso de personal con Cloudflare Access

Crea una aplicación de Access para el dominio de esta instalación. Protege la raíz del dashboard y las rutas de personal `/api/*`. Configura excepciones para `/patient`, `/api/portal/*`, `/api/health`, `/api/tools/*` y `/api/webhooks/*`: estas últimas rutas tienen sus propios controles de firma, sesión o código. Prueba las rutas directamente; no basta con ocultar botones en la UI.

Configura variables propias:

- `ACCESS_TEAM_DOMAIN`: tu-equipo.cloudflareaccess.com
- `ACCESS_AUD`: audiencia de la aplicación de Access.
- `STAFF_ROLES_JSON`: objeto email → admin, reception o viewer.

El Worker verifica firma RS256, emisor, audiencia, vencimiento y lista de roles. No confía solo en el encabezado de email. Admin configura y publica; recepción gestiona agenda/órdenes/solicitudes; viewer consulta. La política del cliente define quién puede ver datos: viewer no implica anonimización. Los cambios guardan actor y estado HTTP en staff_audit.

La contraseña compartida de la demo no concede acceso en este modo. Deshabilita las URLs alternativas no protegidas y prueba también workers.dev si el dominio principal usa Access; el JWT firmado sigue siendo obligatorio en la API de personal.

## 3. Identidad de clientes

En una cuenta propia de Twilio, crea un servicio Verify y configura estos secretos mediante prompts privados de Wrangler:

```sh
npx wrangler secret put TWILIO_ACCOUNT_SID
npx wrangler secret put TWILIO_AUTH_TOKEN
npx wrangler secret put TWILIO_VERIFY_SERVICE_SID
```

El portal `/patient` pide consentimiento para el código SMS, comprueba el resultado `approved` de Verify y crea una cookie HttpOnly de 30 minutos ligada a un único cliente. Hay límites por IP, teléfono y número de intentos; códigos y tokens no se registran en logs. El teléfono se normaliza como E.164 y el índice impide contactos reales duplicados con el mismo teléfono. Un teléfono compartido o reasignado necesita una política adicional del negocio; el código prueba posesión del número, no identidad civil ni tutoría.

No se permite escoger arbitrariamente una persona en producción. Las tools derivan el cliente de la sesión emitida por el servidor. La identidad tiene un máximo de conversaciones por hora; configura además límites/fraud guard en el proveedor para tu mercado.

## 4. CRM HubSpot

Crea una aplicación privada del cliente con los permisos que requieren contactos y tareas en su plan. Configura:

```sh
npx wrangler secret put HUBSPOT_PRIVATE_APP_TOKEN
```

Mantén `CRM_SYNC_ENABLED=false` hasta probar con un contacto de prueba autorizado. Cuando lo actives, las reservas y solicitudes del agente crean trabajos en outbox. El cron procesa hasta 10 trabajos por ejecución; puedes ejecutar `/api/production/crm/run` como admin. Contactos se buscan por teléfono y se vinculan por ID remoto; una solicitud humana crea una tarea asociada al contacto. No envía mensajes ni suscribe contactos a marketing.

El texto de las solicitudes puede contener información sensible: aprueba qué datos se pueden enviar al CRM y ajusta la recopilación del agente. No sincronices expedientes clínicos. Los cambios por fuera del agente no se sincronizan automáticamente en esta versión; el conector cubre las acciones descritas.

Una respuesta incierta pasa a `needs_review` y no se repite automáticamente. Revisa el resultado en HubSpot y vincula el ID correcto antes de reencolar una tarea. Estado `done` solo se guarda después de respuesta confirmada del proveedor. Un proceso interrumpido queda para reconciliación. La agenda funciona aunque falle el CRM, y el agente no presenta ese seguimiento como enviado a una persona.

## 5. Aprobación y retención

Para ensayar conexiones que requieren habilitación, utiliza primero una instalación **QA separada en modo production**, cuentas de prueba y destinatarios autorizados. En esa copia, BUSINESS_APPROVED=true permite ejecutar el proceso durante el ensayo controlado; no significa que ya pasó la aceptación. No expongas ese ensayo a pacientes reales ni conviertas su DB en la instalación final. Así puedes verificar OTP, CRM y voz antes de aceptar la puesta en marcha del negocio.

Completa `production-acceptance.json`, ejecuta `npm run production:check` y revisa la evidencia antes de establecer `BUSINESS_APPROVED=true`. Debes validar: protocolo del negocio, personal autorizado, responsables de solicitudes, retención, pruebas de aislamiento, OTP real, voz real y CRM real. La variable es un bloqueo técnico, no una certificación automática.

`RETENTION_DAYS` controla la conservación local de transcripciones de conversaciones y el audit de personal (mínimo 1, máximo 365 días). La configuración de ElevenLabs se gestiona por separado; por defecto el agente conserva 7 días y no graba audio. Define también la retención de citas, contactos, HubSpot y copias de seguridad con el responsable: esta copia no borra expedientes o contactos por su cuenta.

## 6. Puesta en marcha

1. `npm ci`, `npm run setup`, `npm run db:local`, `npm run build`.
2. Despliega DB, Worker y secretos siguiendo README.md.
3. Configura Access, roles y proveedores; comprueba que la contraseña de demo no funciona.
4. Prueba las integraciones con cuentas y destinatarios autorizados, completa la matriz de aceptación.
5. Aprueba el proceso y activa BUSINESS_APPROVED. Publica el agente desde administración.
6. Prueba voz desde `/patient` y confirma una acción en la agenda y un trabajo de CRM.
7. Documenta el piloto, consumo, errores, responsable y pausa de emergencia antes de ampliar uso.

Las pruebas de integración heredadas de la demo usan contraseña e identidad ficticia y no representan aceptación de este modo. El kit incluye pruebas de los adaptadores y verificación de roles con proveedores simulados; cada instalación debe ejecutar la aceptación real.

## Fuentes oficiales

- [Validar JWT de Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Twilio Verify](https://www.twilio.com/docs/verify/api/verification)
- [HubSpot contactos](https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/contacts/guide)
- [HubSpot tareas y asociaciones](https://developers.hubspot.com/docs/api-reference/legacy/crm/activities/tasks/guide)
