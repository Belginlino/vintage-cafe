import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/pos/AppShell";
import { useDB, setOrderStatus } from "@/lib/pos/store";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";
import type { OrderStatus } from "@/lib/pos/types";

export const Route = createFileRoute("/kitchen")({
  head: () => meta("Kitchen Display", "Live kitchen tickets with preparation timers."),
  component: () => (
    <AppShell perm="kitchen">
      <Kitchen />
    </AppShell>
  ),
});

const next: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  new: { to: "confirmed", label: "Accept" },
  confirmed: { to: "preparing", label: "Start preparing" },
  preparing: { to: "ready", label: "Mark ready" },
  ready: { to: "completed", label: "Handed over" },
};

function Kitchen() {
  const orders = useDB((d) => d.orders.filter((o) => ["new", "confirmed", "preparing", "ready"].includes(o.status)));
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, []);
  const sorted = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return (
    <div className="min-h-screen bg-mahogany p-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-3xl text-champagne">Kitchen Display</h1>
        <span className="text-sm text-sidebar-foreground/70">{sorted.length} active · syncs across tabs on this device</span>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {sorted.map((o) => {
          const mins = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 60000);
          const n = next[o.status];
          return (
            <div key={o.id} className={`flex flex-col rounded-lg border-2 bg-card ${mins >= 15 ? "border-destructive" : o.status === "ready" ? "border-success" : "border-gold"}`}>
              <div className="flex items-center justify-between border-b border-border p-3">
                <div>
                  <div className="text-lg font-bold text-primary">{o.number.split("-").at(-1)}</div>
                  <div className="text-xs capitalize text-muted-foreground">{o.type}{o.tableName ? ` · ${o.tableName}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className={`text-xl font-bold ${mins >= 15 ? "text-destructive" : ""}`}>{mins}m</div>
                  <div className="text-xs uppercase text-muted-foreground">{o.status}</div>
                </div>
              </div>
              <ul className="flex-1 space-y-2 p-3">
                {o.lines.map((l) => (
                  <li key={l.key}>
                    <div className="text-base font-semibold"><span className="text-primary">{l.qty}×</span> {l.name}{l.variant ? ` (${l.variant.name})` : ""}</div>
                    {l.addOns.length > 0 && <div className="text-sm text-muted-foreground">+ {l.addOns.map((a) => a.name).join(", ")}</div>}
                    {l.note && <div className="rounded bg-warning px-2 py-0.5 text-sm font-medium text-warning-foreground">{l.note}</div>}
                  </li>
                ))}
              </ul>
              {n && (
                <button onClick={() => { try { setOrderStatus(o.id, n.to); } catch (e) { toast.error(errMsg(e)); } }} className="m-3 rounded-md bg-primary py-3 text-lg font-semibold text-primary-foreground">
                  {n.label}
                </button>
              )}
            </div>
          );
        })}
        {!sorted.length && <p className="col-span-full py-20 text-center text-xl text-champagne">No tickets. All caught up.</p>}
      </div>
    </div>
  );
}
