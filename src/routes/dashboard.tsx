import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { Stat, Bars } from "@/components/pos/Stats";
import { useDB } from "@/lib/pos/store";
import { formatINR } from "@/lib/pos/billing";
import { summarize, inRange } from "@/lib/pos/reports";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/dashboard")({
  head: () => meta("Dashboard", "Today's sales, best sellers and stock alerts."),
  component: () => (
    <AppShell perm="reports">
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  const orders = useDB((d) => d.orders);
  const categories = useDB((d) => d.categories);
  const products = useDB((d) => d.products);
  const inventory = useDB((d) => d.inventory);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const today = orders.filter((o) => inRange(o, start, new Date()));
  const s = summarize(today, categories, Object.fromEntries(products.map((p) => [p.id, p.categoryId])));
  const low = inventory.filter((i) => i.stock < i.minStock);
  return (
    <div>
      <PageHeader title="Dashboard" subtitle={new Date().toLocaleDateString("en-IN", { dateStyle: "full" })} actions={<Link to="/pos" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">New order</Link>} />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <Stat label="Today's sales" value={formatINR(s.gross)} hint="excl. cancelled" />
          <Stat label="Orders" value={String(s.count)} />
          <Stat label="Avg order" value={formatINR(s.avg)} />
          <Stat label="Paid" value={formatINR(s.paid)} />
          <Stat label="Pending / unpaid" value={formatINR(s.pending)} />
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Bars title="Best sellers" rows={s.products.slice(0, 6).map((p) => [p.name, p.qty])} money={false} />
          <Bars title="Sales by category" rows={s.categories.slice(0, 6)} />
          <Bars title="Payment methods" rows={s.methods} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 text-xl text-primary">Recent orders</h3>
            {orders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0">
                <span>{o.number}</span><span className="capitalize text-muted-foreground">{o.status} · {o.paymentStatus}</span><span className="font-semibold">{formatINR(o.totals.total)}</span>
              </div>
            ))}
            {!orders.length && <p className="text-sm text-muted-foreground">No orders yet.</p>}
          </div>
          <div className="rounded-lg border border-border bg-card p-5 shadow-card">
            <h3 className="mb-3 text-xl text-primary">Low stock</h3>
            {low.map((i) => <div key={i.id} className="flex justify-between py-1 text-sm"><span>{i.name}</span><span className="text-destructive">{i.stock} / {i.minStock} {i.unit}</span></div>)}
            {!low.length && <p className="text-sm text-muted-foreground">All stock above minimum.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
