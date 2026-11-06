# Aceptación observable

Registra cada escenario como PASS, FAIL o NOT_RUN, con comando y evidencia. Los escenarios de voz consumen ElevenLabs y requieren despliegue propio; no los sustituyas por llamadas HTTP al reportar voz probada.

| Escenario | Resultado requerido |
|---|---|
| Acceso anónimo al dashboard | 401, sin datos |
| Servicios | Solo catálogo real del preset |
| Reserva | Preparar no confirma; commit crea una cita |
| Reintento | Una sola reserva tras repetir commit |
| Colisión | No se ocupan simultáneamente profesional o puesto |
| Especialidad | Profesional incompatible rechazado |
| Hora | Fecha y hora locales consistentes en tool, voz y agenda |
| Otra identidad | No puede consultar ni cancelar citas ajenas |
| Cambio | Cita anterior conservada hasta confirmar la nueva |
| Conocimiento | Borrador distinto de publicación |
| Estética | Paquete tiene duración y buffer completos, misma especialista |
| Taller | Tool sin ID de cliente; solo devuelve órdenes propias |
| Taller: edición | Sesión admin necesaria; versión obsoleta produce conflicto |
| Inmobiliaria | La visita bloquea 60 min + 30 de traslado; no inventa propiedades |
| Veterinaria | Una urgencia no termina en cita ni en indicación médica |
| Tipo de agente | Una tool fuera de su lista responde 403 TOOL_NOT_IN_PROFILE |
| Captura | Sin un campo obligatorio responde 400; un reintento no duplica el registro |
| Sin integración | No anuncia SMS, cobro ni transferencia |
| Error de tool | Reconoce error y no inventa confirmación |
| Voz real | Conversación y una acción visibles en el despliegue propio |

Entrega: URL si se desplegó, ubicación del proyecto, estado de cada integración, pruebas ejecutadas y tres siguientes pasos concretos. No incluyas claves, cookies ni enlaces con secretos en el reporte.
