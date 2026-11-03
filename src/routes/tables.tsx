import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { useDB } from "@/lib/pos/store";
import { formatINR } from "@/lib/pos/billing";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/tables")({
  head: () => meta("Tables", "Dine-in table occupancy and open bills."),
  component: () => (
    <AppShell perm="pos">
      <Tables />
    </AppShell>
  ),
});

function Tables() {
  const tables = useDB((d) => d.tables);
  const orders = useDB((d) => d.orders);
  return (
    <div>
      <PageHeader title="Tables" subtitle="Occupied tables have an open dine-in order." actions={<Link to="/pos" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">New order</Link>} />
      <div className="grid grid-cols-2 gap-4 p-8 md:grid-cols-4">
        {tables.map((t) => {
          const open = orders.filter((o) => o.tableId === t.id && !["completed", "cancelled"].includes(o.status));
          return (
            <div key={t.id} className={`rounded-lg border-2 p-5 shadow-card ${open.length ? "border-primary bg-card" : "border-border bg-card"}`}>
              <div className="flex items-baseline justify-between">
                <span className="font-display text-3xl text-primary">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.seats} seats</span>
              </div>
              {open.length ? (
                <div className="mt-3 space-y-1 text-sm">
                  {open.map((o) => (
                    <div key={o.id} className="flex justify-between"><span>{o.number}</span><span className="font-semibold">{formatINR(o.totals.total)}</span></div>
                  ))}
                  <div className="text-xs uppercase text-primary">Occupied</div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-success">Available</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
