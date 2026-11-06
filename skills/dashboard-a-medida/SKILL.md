---
name: dashboard-a-medida
description: Añadir o ajustar páginas y métricas en el dashboard de un proyecto generado con Voice Agent Studio. Usar cuando pidan una página nueva en el dashboard, cambiar las tarjetas del resumen, medir llamadas o citas de otra forma, o adaptar el centro de control a lo que quiere ver un cliente.
---

# Dashboard a medida

Cambia el dashboard de un proyecto ya generado sin romper sus permisos ni sus pruebas. Trabaja en el proyecto del cliente, no en el kit.

## Antes de tocar código

Confirma que estás en un proyecto generado: tiene `business.config.json`, `src/main.tsx` y `worker/index.ts`. Pregunta qué decisión va a tomar el cliente con ese dato: una métrica sin decisión es ruido.

Busca de dónde sale cada dato:

| Quiere ver | Tabla | Columnas útiles |
|---|---|---|
| Llamadas y minutos | `conversations` | `started_at`, `duration` en segundos, `status` |
| Citas | `appointments` | `source` (`agent`, `staff`, `demo`), `status`, `created_at`, `starts_at` |
| Solicitudes al equipo | `staff_requests` | `category`, `priority`, `status`, `created_at` |
| Lista de espera | `waitlist` | `service_id`, `created_at` |
| Prospectos y encuestas | `captures` | `kind`, `score`, `status`, `updated_at` (solo calificador y encuesta) |

Si el dato no existe, dilo. No lo aproximes con otro ni muestres una cifra inventada.

## Ajustar las tarjetas del resumen

En `src/main.tsx` busca `const metrics = [`. Cada tarjeta lleva `label`, `value`, `detail`, `icon` y `color`. Sus datos vienen de `/api/dashboard`.

Ojo: esa ruta limita los resultados, 100 conversaciones y 250 citas. Sirve para lo reciente, no para totales del mes. Para totales crea una ruta propia.

## Crear una página nueva

Sigue [el ejemplo completo](references/pagina-metricas.md). Son cuatro pasos:

1. **Ruta:** en `worker/index.ts`, antes de `app.post("/api/tools/:name",`, añade un `app.get("/api/...")` con consultas agregadas. El middleware ya exige sesión de administración en `/api/*`.
2. **Página:** crea `src/StudioMetrics.tsx`, con `api` de `./lib`. Reutiliza las clases `metrics`, `metric` y `card`.
3. **Navegación:** en `src/main.tsx`, importa la página, añade su id a `type Page`, una entrada en `const nav` y su render junto a `{page === "overview" && (`.
4. **Nombres:** usa las palabras de `business.config.json`. Si el negocio dice socios o alumnos, la página también.

En modo production, `permitted` en `worker/production/access.ts` deja leer `GET` a cualquier rol con sesión. Si la página muestra datos solo para administración, restríngela allí.

## Comprobar

Registra cada punto como PASS, FAIL o NOT_RUN:

- `npm run build` compila sin errores de tipos.
- Con `npm run preview` encendido, `curl -i http://127.0.0.1:8787/api/metrics` sin cookie responde 401.
- Entra al dashboard: la página carga, el móvil no tiene scroll horizontal y un estado vacío se entiende.
- Compara una cifra contra una consulta directa: `npx wrangler d1 execute SLUG --local --command "SELECT COUNT(*) FROM conversations"`.
- `npm test` y `npx playwright test` siguen pasando.

## Reglas

- Las rutas nuevas devuelven conteos, no nombres, teléfonos, resúmenes ni transcripciones, salvo que el cliente lo apruebe y su rol lo permita.
- No pongas una ruta nueva bajo `/api/tools/` ni `/api/webhooks/`: esas se saltan la sesión de administración.
- Los datos de una demo son ficticios. No los presentes como resultados del negocio.
- Cambiar `business.config.json` después de generar no actualiza la interfaz ni la base.
