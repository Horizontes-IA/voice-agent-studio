# Validación de entrega · v1.3.3 · 12 de noviembre de 2026

La v1.3.3 agrega un módulo opcional de Google Calendar (`modules/calendar.ts.txt` y `modules/calendar.sql`) y su guía `conectar-calendario`; no cambia las plantillas generadas ni el agente. Las v1.3.1 y v1.3.2 agregan el instalador de skills, instrucciones para la IA, `npm run check` en la raíz del kit, un reintento en `deploy:guided` y cambios de texto. No cambian las plantillas ni el agente. Salvo lo que sigue, los resultados de esta página se midieron en la v1.3.0, el 4 de noviembre de 2026.

**Prueba del 6 de noviembre, estética con recepción:** instalación limpia desde el repositorio público y despliegue real en Cloudflare y ElevenLabs. Una conversación completa con voz sintética entrando por el micrófono: ElevenLabs transcribió bien las 4 frases y la cita quedó en la agenda, de 14:00 a 15:15 más 15 de preparación. Dental y taller no se probaron con este método.

**Prueba del 12 de noviembre, estética con recepción y Google Calendar:** demo desplegada en Cloudflare y ElevenLabs con el módulo de Calendar. Una persona habló en un micrófono real desde el dashboard: 163 segundos, el agente buscó huecos, pidió confirmación y reservó con `status=booked`; la cita quedó en la agenda y su evento apareció en Google Calendar, con la hora local correcta y sin enlace de Meet. Crear, mover y cancelar se probaron en local contra Google Calendar real; en producción se probó crear, por la tarea programada y por la llamada. En modo demo la cita sale a nombre de la identidad ficticia elegida por administración, no de quien llama.

La v1.3.0 agrega doce negocios, ocho skills y tres herramientas. Todo lo nuevo se probó en local. **Nada nuevo se ha probado con voz real de ElevenLabs ni por teléfono.** La versión tiene 21 plantillas: 3 con voz real y 18 sin ella.

| Comprobación | Resultado | Alcance |
|---|---|---|
| Kit, generador, tipos de agente y skills | 131 pruebas PASS | Conteos, vocabulario, reglas de salud, frontmatter, archivos que nombra cada skill y fórmulas de cotización y valoración |
| API de los 21 negocios | 13 pruebas PASS por negocio | Identidad, reserva, cambio, cancelación, concurrencia, idempotencia y fechas locales |
| Dashboard de los 21 negocios | PASS | Escritorio/móvil, navegación, edición y foco |
| Vocabulario en navegador | 0 coincidencias | Motos, manejo, gimnasio, seguros, eventos y spa: 8 vistas de cada uno, buscando palabras dentales, clínica, paciente y receta |
| Vocabulario en código generado | PASS | Los 20 negocios no dentales: interfaz, Worker, prompt, conocimiento y README |
| Informativo sobre veterinaria y laboratorio | Comprobador PASS | Tools publicadas y rechazo con 403 de las demás. `npm test` no aplica: reserva con tools que este tipo no tiene |
| Calificador sobre inmobiliaria y seguros | 13 pruebas API y comprobador PASS | Campos obligatorios, opciones, negativa a contestar, reintento sin duplicar y dashboard |
| Encuesta sobre fisioterapia y spa | Comprobador PASS | Calificación fuera de rango, reintento y dashboard. `npm test` no aplica por la misma razón que informativo |
| Configuración adicional | 13 pruebas API y 5 aserciones PASS | Domingo abierto, tres recursos, recurso restringido, cierres, zona europea y DKK |
| Production dental | PASS | Compilación, controles negativos y recorrido HTTP de 6 grupos con proveedores simulados |
| Production en plantillas nuevas | Parcial | Las 12 generan. Solo seguros se compiló. Ninguna tuvo recorrido HTTP |
| Recepción dental, estética y taller | Idénticos a la 1.2 | `worker/policy.ts` y `worker/eleven.ts` generados, comparados byte por byte y fijados con SHA-256 en las pruebas. Por eso sigue aplicando la evidencia de voz de abajo |
| Cotizador y calculadora | PASS | Mismas cifras con los mismos datos. Los valores de ejemplo siguen dando USD 385.20 de costo y USD 642 de mensualidad |
| Valoración | PASS | Rechaza datos faltantes y fracciones, y el comando coincide con la página |
| Reporte mensual | PASS en D1 local | Proyecto generado con conversaciones y solicitudes de prueba: las cifras coinciden con una consulta directa |
| Receta de `dashboard-a-medida` | PASS | Aplicada tal cual a un proyecto de gimnasio: compila, responde 401 sin sesión, sus cifras coinciden con la base y no tiene scroll horizontal en móvil |
| Estructura de los 12 skills | PASS | `quick_validate.py` del skill-creator de Codex, sobre frontmatter |
| Recorrido independiente | Hallazgos corregidos | Un agente siguió `plantilla-nueva`, `valorar-negocio`, `cotizar-agente` y `analizar-llamadas` leyendo sus instrucciones. Encontró huecos que ya se corrigieron. El recorrido no se repitió después |
| Kit exportado fuera del workspace | PASS | Desde el ZIP, en una ruta con espacios: `npm ci`, 131 pruebas, generación de manejo con calificador, secretos, D1 local y compilación |

## Sin probar

- **NOT_RUN:** voz real en las 18 plantillas sin evidencia de voz y en los tipos informativo, calificador y encuesta.
- **NOT_RUN:** los 12 escenarios nuevos de `policy-cases.json` con `evaluate-eleven --run`, ni los 9 de la 1.2. Existen, pero nunca se ejecutaron contra ElevenLabs.
- **NOT_RUN:** invocar los skills desde Claude Code o Codex como comando.
- **NOT_RUN:** seguir de punta a punta `propuesta-cliente`, `entrega-cliente` y `conectar-telefono`. Se comprobó su estructura y que existan los archivos que nombran.
- **NOT_RUN:** `conectar-telefono` contra un teléfono real. Es una guía: el kit sigue atendiendo por navegador y falta el desarrollo que describe.
- **NOT_RUN:** el módulo de Calendar en otras plantillas, en modo production y con mover o cancelar en producción. Los costos y límites de Composio para varios clientes no se verificaron.
- **NOT_RUN:** `reporte-llamadas --remote` contra una D1 desplegada.
- **NOT_RUN:** revisión de las políticas de salud, legales y financieras por un profesional de cada sector.

El comprobador es `tools/check-profile.mjs`. Prueba por HTTP local, no la conversación: que un agente derive una urgencia o no dé un diagnóstico depende del prompt y solo se comprueba hablando con él.

---

# Validación de entrega · v1.2.0 · 4 de noviembre de 2026

Esta versión agrega seis negocios, tres tipos de agente y tres skills. Todo lo nuevo se probó en local. **Nada nuevo se ha probado con voz real de ElevenLabs.**

| Comprobación | Resultado | Alcance |
|---|---|---|
| Kit, generador, tipos de agente y skills | 62 pruebas PASS | Plantillas, prompts sin herramientas ajenas, formularios inválidos y estructura de cada skill |
| API de los nueve negocios | 13 pruebas PASS por negocio | Identidad, reserva, cambio, cancelación, concurrencia, idempotencia y fechas locales |
| Dashboard de los nueve negocios | PASS | Escritorio/móvil, navegación, edición y foco |
| Informativo sobre veterinaria | PASS | Tools publicadas y rechazo con 403 de las demás. `npm test` no aplica: reserva con tools que este tipo no tiene |
| Calificador sobre inmobiliaria | 13 pruebas API y comprobador PASS | Campos obligatorios, opciones, negativa a contestar, reintento sin duplicar y dashboard |
| Encuesta sobre fisioterapia | Comprobador PASS | Calificación fuera de rango, reintento y dashboard. `npm test` no aplica por la misma razón que informativo |
| Negocio sin plantilla | PASS | Clínica de nutrición con `agent.sectorPolicy`, preguntas propias y el comprobador. Su prompt no conserva reglas de fisioterapia |
| Production | PASS | Compilación, controles negativos y recorrido HTTP con proveedores simulados |
| Recepción dental, estética y taller | Prompt y tools idénticos a la 1.1 | Comparación de `worker/policy.ts` y `worker/eleven.ts` generados. Por eso sigue aplicando la evidencia de voz de abajo |

## Sin probar

- **NOT_RUN:** voz real en los seis negocios nuevos y los tres tipos de agente nuevos.
- **NOT_RUN:** los nueve escenarios nuevos de `policy-cases.json` con `evaluate-eleven --run`. Existen, pero nunca se ejecutaron contra ElevenLabs.
- **NOT_RUN:** invocar los skills desde Claude Code o Codex como comando. Un recorrido independiente siguió `agente-calificador` leyendo sus instrucciones. Encontró huecos que ya se corrigieron, y ese recorrido no se repitió después.

El comprobador es `tools/check-profile.mjs`. Prueba por HTTP local, no la conversación: que el agente no presione o no discuta una calificación depende del prompt y solo se comprueba hablando con él.

---

# Validación de entrega · v1.1.0 · 18 de octubre de 2026

Esta versión añade instalación y despliegue guiados, reglas de agenda configurables y pruebas de los tres proyectos con ElevenLabs real. La aceptación de una instalación de cliente sigue siendo específica de sus procesos y cuentas.

| Comprobación | Resultado | Alcance |
|---|---|---|
| Kit, generador y adaptadores | 21 pruebas PASS | Aislamiento, configuración, JWT firmado, roles, identidad, CRM, outbox y recorrido de arranque |
| API dental / estética / taller | 13 pruebas PASS por sector | Identidad, reserva, cambio, cancelación, concurrencia, idempotencia y fechas locales |
| Configuración adicional | 13 pruebas API y 5 aserciones específicas PASS | Domingo abierto, tres recursos, recurso restringido, cierres, zona Europe/Copenhagen, DKK y conocimiento coherente |
| Dashboard de las cuatro demos | PASS | Escritorio/móvil, navegación, edición y foco |
| Taller: órdenes | 6 aserciones PASS | Anónimo rechazado, orden propia, actualización y conflicto de versión |
| Presupuesto de tools | PASS en las cuatro demos | Tercera consulta de catálogo rechazada por servidor; el límite cuenta llamadas totales, incluso exitosas |
| Production: compilación y controles negativos | PASS | Migraciones, anónimo/JWT inventado, OTP no habilitado y tool bloqueada |
| Production: recorrido positivo HTTP | 6 grupos PASS | D1 local real con proveedores simulados: JWT por rol, OTP, sesión propia, reserva/cambio/cancelación, outbox→CRM, auditoría y logout |
| Simulación de conversación | 18 PASS | Seis casos por cada agente propio, herramientas simuladas y control de trayectoria |
| Dental con SDK/audio/tools reales | PASS | Reserva, cambio de la misma cita y cancelación; 26 frames de audio recibidos |
| Estética con SDK/audio/tools reales | PASS | Paquete de 75 min + 15 de buffer, reserva y cancelación; 18 frames de audio |
| Taller con SDK/audio/tools reales | PASS | Reserva, cancelación y lectura de orden propia; 26 frames de audio |
| Instalación nueva en Cloudflare | PASS en tres instalaciones | D1, migraciones, Worker HTTPS, secretos y agente dedicado; se probó continuar tras una respuesta transitoria de health |
| Kit exportado fuera del workspace | PASS | npm ci, 21 pruebas, generación y secretos en rutas con espacios; no depende de la carpeta original |
| Skill | PASS | Estructura/metadatos y recorrido de generación con CLI; no es una prueba independiente con alumnos |

## Qué demuestra cada capa

Las pruebas con SDK usan Chrome, ElevenLabs Agents, audio real del proveedor y tools reales de Workers/D1. La persona de prueba se selecciona en la demo y las peticiones se escriben dentro de la sesión de voz. Se comprueba el resultado persistido, la identidad y el tiempo ocupado. **No se probó ASR humano**, comprensión de acentos ni interrupciones habladas. Los frames recibidos demuestran audio de salida, no una medición de calidad perceptual o latencia garantizada.

Las simulaciones conversacionales usan los agentes publicados por cada negocio y mocks de tools con fallback de error. No escriben citas ni prueban micrófono. Una ejecución previa dejó el caso de fecha ambigua inconcluso porque también simulaba una caída del catálogo. Se separaron ambos casos: aclaración recibe catálogo disponible y fallo de catálogo mantiene su error. La suite final tiene 18 PASS sin fallos de trayectoria detectados. Un juez automático no sustituye revisión y aceptación humana.

El recorrido positivo de production usa un JWT de prueba firmado y SQLite mediante D1 de Miniflare; Access, Twilio, HubSpot y el endpoint firmado de voz son dobles de prueba. Comprueba cómo se conectan las rutas y estados sin enviar SMS o modificar un CRM real. El backend usa su verificación normal; no se añade un bypass para las pruebas.

El despliegue asistido rechaza nombres ocupados y conserva IDs y estado de escritura. No es una transacción entre proveedores: una interrupción puede dejar recursos creados y requiere reanudar/reconciliar con el estado privado. No adopta instalaciones ajenas ni convierte una DB de demo en production.

## Evidencia y reproducción

- [Pruebas locales](evaluations/results/local-validation.json)
- [SDK/audio y acciones persistidas](evaluations/results/sdk-live-voice.json)
- [Production HTTP con proveedores simulados](evaluations/results/production-http.json)
- [Kit portátil](evaluations/results/portable-kit.json)
- [Política dental](evaluations/results/dental-policy.json), [estética](evaluations/results/salon-policy.json) y [taller](evaluations/results/garage-policy.json)

Los comandos están en [evaluations/README.md](evaluations/README.md). Las evidencias distribuidas contienen resúmenes; los transcripts, cookies y credenciales de QA permanecen privados. El hash permite identificar cada prompt evaluado. GitHub Actions vuelve a ejecutar las pruebas locales; no ejecuta simulaciones o voz con una cuenta de proveedor.

## Pendiente por instalación

- **NOT_RUN:** HubSpot real: crear/actualizar contacto y tarea asociada en la cuenta del cliente.
- **NOT_RUN:** SMS de Twilio Verify recibido y validado por una persona real.
- **NOT_RUN:** aplicación real de Cloudflare Access, política de acceso y alta/baja del personal.
- **NOT_RUN:** ASR, nombres, acentos, interrupciones y latencia con usuarios del negocio.
- **NOT_RUN:** aceptación de protocolos, retención, responsables y soporte por el negocio.

La agenda oficial implementada es D1. No se incluye conector de Google Calendar/software dental, telefonía, WhatsApp, pagos ni transferencia en vivo. Si el cliente necesita otra fuente oficial, debe implementarse y probarse antes de vender esa sincronización.

Production conserva BUSINESS_APPROVED=false y la aceptación en NOT_RUN al generar. Tener código o credenciales no convierte una instalación en producción aprobada. No ofrezcas las pruebas de esta entrega como aceptación de las cuentas de otro negocio.
