import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download } from "lucide-react";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { Stat, Bars } from "@/components/pos/Stats";
import { useDB } from "@/lib/pos/store";
import { formatINR } from "@/lib/pos/billing";
import { summarize, inRange } from "@/lib/pos/reports";
import { downloadCSV } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/reports")({
  head: () => meta("Reports", "Daily, weekly, monthly and custom sales reports with CSV export."),
  component: () => (
    <AppShell perm="reports">
      <Reports />
    </AppShell>
  ),
});

const iso = (d: Date) => d.toISOString().slice(0, 10);

function Reports() {
  const orders = useDB((d) => d.orders);
  const categories = useDB((d) => d.categories);
  const products = useDB((d) => d.products);
  const [from, setFrom] = useState(iso(new Date()));
  const [to, setTo] = useState(iso(new Date()));
  const preset = (days: number) => { const f = new Date(); f.setDate(f.getDate() - days + 1); setFrom(iso(f)); setTo(iso(new Date())); };
  const f = new Date(from + "T00:00:00");
  const t = new Date(to + "T23:59:59.999");
  const list = orders.filter((o) => inRange(o, f, t));
  const s = summarize(list, categories, Object.fromEntries(products.map((p) => [p.id, p.categoryId])));

  const exportOrders = () =>
    downloadCSV(`orders_${from}_${to}.csv`, [
      ["Order", "Date", "Type", "Status", "Payment", "Method", "Subtotal", "Discount", "Tax", "Total"],
      ...list.map((o) => [o.number, o.createdAt, o.type, o.status, o.paymentStatus, o.payments.at(-1)?.method ?? "", o.totals.subtotal / 100, o.totals.discount / 100, o.totals.tax / 100, o.totals.total / 100]),
    ]);
  const exportProducts = () => downloadCSV(`products_${from}_${to}.csv`, [["Product", "Qty", "Amount"], ...s.products.map((p) => [p.name, p.qty, p.amount / 100])]);

  return (
    <div>
      <PageHeader
        title="Reports"
        actions={<>
          {[["Today", 1], ["7 days", 7], ["30 days", 30]].map(([l, d]) => <button key={l} onClick={() => preset(d as number)} className="rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-gold">{l}</button>)}
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-md border border-input bg-card px-2 text-sm" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-md border border-input bg-card px-2 text-sm" />
          <button onClick={exportOrders} className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"><Download className="h-4 w-4" /> Orders CSV</button>
          <button onClick={exportProducts} className="flex items-center gap-1 rounded-md border border-primary px-3 py-2 text-sm text-primary"><Download className="h-4 w-4" /> Products CSV</button>
        </>}
      />
      <div className="space-y-6 p-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
          <Stat label="Net sales" value={formatINR(s.gross)} />
          <Stat label="Paid" value={formatINR(s.paid)} />
          <Stat label="Unpaid/pending" value={formatINR(s.pending)} />
          <Stat label="Discounts" value={formatINR(s.discount)} />
          <Stat label="Tax collected" value={formatINR(s.tax)} />
          <Stat label="Cancelled" value={String(s.cancelled.length)} hint={formatINR(s.cancelled.reduce((a, o) => a + o.totals.total, 0))} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Bars title="Product sales" rows={s.products.slice(0, 12).map((p) => [`${p.name} ×${p.qty}`, p.amount])} />
          <Bars title="Category sales" rows={s.categories} />
          <Bars title="Payment methods (verified)" rows={s.methods} />
          <Bars title="Tax summary" rows={s.taxes} />
        </div>
        {s.cancelled.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-2 text-xl text-primary">Cancelled orders</h3>
            {s.cancelled.map((o) => <div key={o.id} className="flex justify-between py-1 text-sm"><span>{o.number}</span><span className="text-muted-foreground">{o.cancelReason}</span><span>{formatINR(o.totals.total)}</span></div>)}
          </div>
        )}
      </div>
    </div>
  );
}
