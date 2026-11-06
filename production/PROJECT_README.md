# {{BUSINESS_NAME}} · Candidato de implementación

Esta instalación usa modo production: dashboard para personal con Cloudflare Access, portal de clientes con Twilio Verify, agenda en D1 y seguimiento con HubSpot. No carga personas ni citas de demostración y se genera con BUSINESS_APPROVED=false.

## Preparación y despliegue

```sh
npm ci
npm run setup
npm run db:local
npm run build
npx wrangler login
npm run deploy:guided
```

El asistente crea recursos propios y despliega un candidato bloqueado. No publica el agente ni activa proveedores automáticamente. El dashboard exige JWT válido de Access: la contraseña de la demo no concede acceso. El primer acceso de personal autorizado inicializa catálogo, equipo y conocimiento.

Sigue **[PRODUCCION.md](PRODUCCION.md)** para configurar Access, roles, Twilio, HubSpot, retención y pruebas. Cada cuenta debe pertenecer a esta implementación. Los secretos se configuran con prompts privados de Wrangler o variables privadas; nunca se pegan en el chat, business.config.json ni variables VITE_.

## Ensayo y aceptación

Usa una instalación de QA separada en modo production, con cuentas y destinatarios de prueba autorizados. Solo allí habilita BUSINESS_APPROVED para ensayar las conexiones que requieren el bloqueo abierto; esa variable permite ejecutar procesos, no certifica sus pruebas. No atiendas clientes reales durante el ensayo. No conviertas la DB de QA en la DB del negocio.

En la instalación final registra evidencia propia, revisión de protocolos y aprobación en production-acceptance.json. Ejecuta `npm run production:check` antes de habilitar atención al público. Publica el agente desde administración, prueba el portal `/patient` y conserva el plan de pausa y soporte.

Las pruebas heredadas de demo usan contraseña e identidad ficticia; no sirven como aceptación de este modo. El kit padre incluye `tools/production-http.mjs` para comprobar las rutas con D1 temporal y proveedores simulados, más materiales de aceptación para cuentas reales.

## Cambios y límites

Consulta business.config.json y AGENTS.md antes de editar. Modificar el JSON no migra un catálogo ya creado: prepara migraciones explícitas y publica el conocimiento aprobado. La agenda oficial es D1. Este proyecto no incluye calendario externo, WhatsApp, telefonía, pagos o transferencia en vivo.

Acceso, verificación, CRM y voz deben comprobarse en cada cuenta. Las pruebas de otra implementación no certifican esta instalación.
