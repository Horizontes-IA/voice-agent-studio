# Ejemplo: una página de métricas

Probado sobre un proyecto generado: compila y la ruta responde 401 sin sesión. Adapta las consultas a lo que pidió el cliente.

## 1. Ruta en `worker/index.ts`

Pégala justo antes de `app.post("/api/tools/:name",`:

```ts
app.get("/api/metrics", async (c) => {
  const days = Math.min(Math.max(Number(c.req.query("days")) || 30, 1), 365);
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 19).replace("T", " ");
  const db = c.env.DB;
  const [calls, booked, open] = await db.batch<{ n: number; seconds?: number }>([
    db.prepare("SELECT COUNT(*) n, COALESCE(SUM(duration),0) seconds FROM conversations WHERE started_at>=?").bind(since),
    db.prepare("SELECT COUNT(*) n FROM appointments WHERE source='agent' AND created_at>=?").bind(since),
    db.prepare("SELECT COUNT(*) n FROM staff_requests WHERE status!='resolved' AND created_at>=?").bind(since),
  ]);
  return c.json({
    days,
    calls: calls.results[0].n,
    minutes: Math.round((calls.results[0].seconds ?? 0) / 60),
    booked: booked.results[0].n,
    open_requests: open.results[0].n,
  });
});
```

`started_at` y `created_at` se guardan en UTC. Si necesitas cortes exactos por mes local, conviértelos con la zona de `business.config.json`.

## 2. Página en `src/StudioMetrics.tsx`

```tsx
import { useEffect, useState } from "react";
import { api } from "./lib";

type Metrics = { days: number; calls: number; minutes: number; booked: number; open_requests: number };

export default function StudioMetrics() {
  const [m, setM] = useState<Metrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    api<Metrics>("/metrics").then(setM).catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"));
  }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!m) return <p>Cargando…</p>;
  const rows: [string, number][] = [
    ["Llamadas", m.calls],
    ["Minutos", m.minutes],
    ["Citas creadas por el agente", m.booked],
    ["Solicitudes sin resolver", m.open_requests],
  ];
  return (
    <section>
      <h1>Métricas</h1>
      <p>Últimos {m.days} días.</p>
      <div className="metrics">
        {rows.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
```

## 3. Cambios en `src/main.tsx`

Al inicio del archivo:

```tsx
import StudioMetrics from "./StudioMetrics";
```

En `type Page`, cambia `"overview" | "agenda"` por:

```tsx
"metrics" | "overview" | "agenda"
```

Dentro de `const nav`, añade:

```tsx
{ id: "metrics", label: "Métricas", icon: ActivityIcon },
```

Antes de `{page === "overview" && (`, añade:

```tsx
{page === "metrics" && <StudioMetrics />}
```

## 4. Comprobar

```sh
npm run build
npm run preview
curl -i http://127.0.0.1:8787/api/metrics
```

El `curl` sin cookie debe responder 401. Después entra al dashboard y abre Métricas.
