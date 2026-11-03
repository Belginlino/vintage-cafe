import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { useDB, saveCustomer, newId } from "@/lib/pos/store";
import { formatINR } from "@/lib/pos/billing";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/customers")({
  head: () => meta("Customers", "Regular guests and their order history."),
  component: () => (
    <AppShell perm="customers">
      <Customers />
    </AppShell>
  ),
});

function Customers() {
  const customers = useDB((d) => d.customers);
  const orders = useDB((d) => d.orders);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const list = customers.filter((c) => (c.name + c.phone).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <PageHeader title="Customers" subtitle="Added automatically when a phone number is entered on an order." />
      <div className="space-y-4 p-8">
        <div className="flex flex-wrap gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="rounded-md border border-input bg-card px-3 py-2 text-sm" />
          <div className="ml-auto flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="rounded-md border border-input bg-card px-3 py-2 text-sm" />
            <input value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="Phone" className="rounded-md border border-input bg-card px-3 py-2 text-sm" />
            <button onClick={() => { try { saveCustomer({ id: newId(), name, phone, createdAt: new Date().toISOString() }); setName(""); setPhone(""); toast.success("Customer added"); } catch (e) { toast.error(errMsg(e)); } }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add</button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Phone</th><th className="p-3 text-right">Orders</th><th className="p-3 text-right">Spent (paid)</th></tr></thead>
            <tbody>
              {list.map((c) => {
                const mine = orders.filter((o) => o.customerId === c.id);
                return (
                  <tr key={c.id} className="border-t border-border">
                    <td className="p-3 font-medium">{c.name}</td><td className="p-3">{c.phone}</td>
                    <td className="p-3 text-right">{mine.length}</td>
                    <td className="p-3 text-right">{formatINR(mine.filter((o) => o.paymentStatus === "paid").reduce((s, o) => s + o.totals.total, 0))}</td>
                  </tr>
                );
              })}
              {!list.length && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No customers yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
