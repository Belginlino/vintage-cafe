import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { useDB, setOrderStatus, verifyPayment, currentStaff } from "@/lib/pos/store";
import { formatINR } from "@/lib/pos/billing";
import { can } from "@/lib/pos/permissions";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";
import type { OrderStatus } from "@/lib/pos/types";

export const Route = createFileRoute("/orders")({
  head: () => meta("Orders", "Track, pay and reprint café orders."),
  component: () => (
    <AppShell perm="orders.view">
      <Orders />
    </AppShell>
  ),
});

export const statusStyle: Record<OrderStatus, string> = {
  new: "bg-muted text-foreground",
  confirmed: "bg-accent text-accent-foreground",
  preparing: "bg-warning text-warning-foreground",
  ready: "bg-success text-success-foreground",
  completed: "bg-secondary text-muted-foreground",
  cancelled: "bg-destructive text-destructive-foreground",
};

function Orders() {
  const orders = useDB((d) => d.orders);
  const me = useDB((d) => currentStaff(d));
  const [filter, setFilter] = useState<"active" | "all" | "unpaid">("active");
  const [open, setOpen] = useState<string | null>(null);
  const list = orders.filter((o) => (filter === "active" ? !["completed", "cancelled"].includes(o.status) : filter === "unpaid" ? o.paymentStatus !== "paid" && o.status !== "cancelled" : true));

  const act = (fn: () => void) => {
    try {
      fn();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        subtitle={`${orders.length} orders recorded`}
        actions={(["active", "unpaid", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${filter === f ? "border-gold bg-primary text-primary-foreground" : "border-border bg-card"}`}>{f}</button>
        ))}
      />
      <div className="p-8">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">Order</th><th className="p-3">Time</th><th className="p-3">Type</th><th className="p-3">Items</th><th className="p-3 text-right">Total</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3" /></tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const pending = o.payments.find((p) => p.status === "pending");
                return (
                  <tr key={o.id} className="border-t border-border">
                    <td className="p-3 font-semibold text-primary">{o.number}</td>
                    <td className="p-3">{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="p-3 capitalize">{o.type}{o.tableName ? ` · ${o.tableName}` : ""}</td>
                    <td className="p-3">{o.lines.reduce((s, l) => s + l.qty, 0)}</td>
                    <td className="p-3 text-right font-semibold">{formatINR(o.totals.total)}</td>
                    <td className="p-3 capitalize">{o.paymentStatus}{o.payments.at(-1) ? ` · ${o.payments.at(-1)!.method}` : ""}</td>
                    <td className="p-3"><span className={`rounded-full px-2 py-0.5 text-xs capitalize ${statusStyle[o.status]}`}>{o.status}</span></td>
                    <td className="space-x-2 whitespace-nowrap p-3 text-right">
                      {o.status !== "cancelled" && <button onClick={() => setOpen(o.id)} className="text-primary underline">{o.paymentStatus === "unpaid" ? "Pay" : "Receipt"}</button>}
                      {pending && can(me?.role, "payment.verify") && <button onClick={() => act(() => verifyPayment(o.id, pending.id, prompt("UPI reference (optional)") ?? undefined))} className="text-success underline">Verify</button>}
                      {o.status === "ready" && <button onClick={() => act(() => setOrderStatus(o.id, "completed"))} className="text-primary underline">Hand over</button>}
                      {can(me?.role, "orders.cancel") && !["completed", "cancelled"].includes(o.status) && (
                        <button onClick={() => { const r = prompt("Reason for cancellation"); if (r) act(() => setOrderStatus(o.id, "cancelled", r)); }} className="text-destructive underline">Cancel</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={8} className="p-10 text-center text-muted-foreground">No orders here yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {open && <PaymentDialog orderId={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
