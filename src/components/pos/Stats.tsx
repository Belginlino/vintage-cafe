import { formatINR } from "@/lib/pos/billing";

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold text-primary">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Bars({ title, rows, money = true }: { title: string; rows: [string, number][]; money?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-card">
      <h3 className="mb-3 text-xl text-primary">{title}</h3>
      {!rows.length && <p className="text-sm text-muted-foreground">No data yet.</p>}
      <div className="space-y-2">
        {rows.map(([k, v], i) => (
          <div key={k} className="text-sm">
            <div className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{money ? formatINR(v) : v}</span></div>
            <div className="mt-1 h-2 rounded-full bg-muted">
              <div className={`h-2 rounded-full ${i % 2 ? "bg-gold" : "bg-primary"}`} style={{ width: `${(v / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
