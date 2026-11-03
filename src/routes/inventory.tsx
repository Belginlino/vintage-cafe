import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { useDB, moveStock, saveInventoryItem, saveProduct, newId } from "@/lib/pos/store";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";

export const Route = createFileRoute("/inventory")({
  head: () => meta("Inventory", "Stock levels, receipts, adjustments and recipes."),
  component: () => (
    <AppShell perm="inventory.manage">
      <Inventory />
    </AppShell>
  ),
});

function Inventory() {
  const items = useDB((d) => d.inventory);
  const moves = useDB((d) => d.movements);
  const products = useDB((d) => d.products.filter((p) => !p.archived));
  const [recipeFor, setRecipeFor] = useState("");
  const run = (fn: () => void, ok?: string) => { try { fn(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e)); } };
  const move = (id: string, kind: "opening" | "received" | "adjustment") => {
    const q = prompt(kind === "adjustment" ? "Adjustment qty (negative to reduce)" : "Quantity");
    if (!q) return;
    const note = kind === "adjustment" ? prompt("Reason for adjustment") ?? "" : prompt("Note (optional)") ?? "";
    run(() => moveStock(id, kind, parseFloat(q), note), "Stock updated");
  };
  const prod = products.find((p) => p.id === recipeFor);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Recipe deductions happen once, when an order is completed."
        actions={<button onClick={() => { const name = prompt("Item name"); const unit = name && prompt("Unit (g, ml, pcs)"); if (name && unit) run(() => saveInventoryItem({ id: newId(), name, unit, stock: 0, minStock: 0 }), "Item added"); }} className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Stock item</button>}
      />
      <div className="grid gap-8 p-8 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Item</th><th className="p-3 text-right">Current</th><th className="p-3 text-right">Minimum</th><th className="p-3" /></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-t border-border">
                    <td className="p-3 font-medium">{i.name} {i.stock < i.minStock && <AlertTriangle className="ml-1 inline h-4 w-4 text-warning" />}</td>
                    <td className={`p-3 text-right font-semibold ${i.stock < i.minStock ? "text-destructive" : ""}`}>{i.stock} {i.unit}</td>
                    <td className="p-3 text-right"><button onClick={() => { const m = prompt("Minimum stock", String(i.minStock)); if (m) run(() => saveInventoryItem({ ...i, minStock: parseFloat(m) })); }} className="underline">{i.minStock} {i.unit}</button></td>
                    <td className="space-x-3 p-3 text-right text-primary">
                      <button onClick={() => move(i.id, "opening")} className="underline">Opening</button>
                      <button onClick={() => move(i.id, "received")} className="underline">Receive</button>
                      <button onClick={() => move(i.id, "adjustment")} className="underline">Adjust</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h2 className="mb-2 mt-8 text-2xl text-primary">Movement history</h2>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-card text-sm">
            {moves.map((m) => (
              <div key={m.id} className="flex gap-3 border-b border-border p-2 last:border-0">
                <span className="w-36 text-muted-foreground">{new Date(m.at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</span>
                <span className="w-32">{items.find((i) => i.id === m.itemId)?.name}</span>
                <span className="w-24 capitalize">{m.kind}</span>
                <span className={`w-16 text-right font-semibold ${m.qty < 0 ? "text-destructive" : "text-success"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</span>
                <span className="flex-1 text-muted-foreground">{m.note} · {m.by}</span>
              </div>
            ))}
            {!moves.length && <p className="p-4 text-muted-foreground">No movements yet.</p>}
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-2xl text-primary">Recipes</h2>
          <p className="mb-3 text-sm text-muted-foreground">Optional. Set how much stock one unit of a product uses.</p>
          <select value={recipeFor} onChange={(e) => setRecipeFor(e.target.value)} className="mb-3 w-full rounded-md border border-input bg-card px-3 py-2 text-sm">
            <option value="">Choose product…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {prod && (
            <div className="space-y-2 rounded-lg border border-border bg-card p-4 text-sm">
              {items.map((i) => {
                const r = prod.recipe?.find((x) => x.itemId === i.id);
                return (
                  <label key={i.id} className="flex items-center justify-between gap-2">
                    <span>{i.name} ({i.unit})</span>
                    <input type="number" min={0} defaultValue={r?.qty ?? ""} key={prod.id + i.id} className="w-24 rounded border border-input px-2 py-1"
                      onBlur={(e) => {
                        const qty = parseFloat(e.target.value) || 0;
                        const recipe = [...(prod.recipe ?? []).filter((x) => x.itemId !== i.id), ...(qty > 0 ? [{ itemId: i.id, qty }] : [])];
                        run(() => saveProduct({ ...prod, recipe }));
                      }} />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
