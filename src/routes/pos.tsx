import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2, ShoppingBag, Leaf, Drumstick, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/pos/AppShell";
import { PaymentDialog } from "@/components/pos/PaymentDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDB, buildLines, createOrder, getDB, newId, type CartInput } from "@/lib/pos/store";
import { calculateTotals, formatINR, lineTotal, toPaise } from "@/lib/pos/billing";
import { imageFor } from "@/lib/pos/images";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";
import type { Discount, Order, OrderType, Product } from "@/lib/pos/types";

export const Route = createFileRoute("/pos")({
  head: () => meta("New Order", "Fast billing terminal for dine-in and takeaway orders."),
  component: () => (
    <AppShell perm="pos">
      <POS />
    </AppShell>
  ),
});

function POS() {
  const products = useDB((d) => d.products);
  const categories = useDB((d) => d.categories);
  const tables = useDB((d) => d.tables);
  const settings = useDB((d) => d.settings);
  const orders = useDB((d) => d.orders);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartInput[]>([]);
  const [type, setType] = useState<OrderType>("takeaway");
  const [tableId, setTableId] = useState("");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [discKind, setDiscKind] = useState<"none" | "fixed" | "percent">("none");
  const [discVal, setDiscVal] = useState("");
  const [custom, setCustom] = useState<Product | null>(null);
  const [placing, setPlacing] = useState(false);
  const [idem, setIdem] = useState(newId);
  const [payOrder, setPayOrder] = useState<Order | null>(null);

  const visible = products.filter(
    (p) => !p.archived && (cat === "all" || p.categoryId === cat) && p.name.toLowerCase().includes(q.toLowerCase()),
  );
  const discount: Discount =
    discKind === "fixed" ? { kind: "fixed", amount: toPaise(discVal) } : discKind === "percent" ? { kind: "percent", bp: Math.round(parseFloat(discVal || "0") * 100) } : { kind: "none" };

  const { lines, totals, error } = useMemo(() => {
    try {
      const lines = buildLines(getDB(), cart);
      return { lines, totals: calculateTotals(lines, discount, settings.taxInclusive), error: null };
    } catch (e) {
      return { lines: [], totals: null, error: errMsg(e) };
    }
  }, [cart, discKind, discVal, settings.taxInclusive, products]);

  const busyTables = new Set(orders.filter((o) => o.tableId && !["completed", "cancelled"].includes(o.status)).map((o) => o.tableId));

  const add = (item: CartInput) => {
    setCart((c) => {
      const key = (x: CartInput) => `${x.productId}|${x.variantId ?? ""}|${[...x.addOnIds].sort().join(",")}|${x.note ?? ""}`;
      const i = c.findIndex((x) => key(x) === key(item));
      if (i >= 0) return c.map((x, j) => (j === i ? { ...x, qty: x.qty + item.qty } : x));
      return [...c, item];
    });
  };
  const onProduct = (p: Product) => {
    if (!p.available) { toast.error(`${p.name} is unavailable`); return; }
    if (p.variants.length || p.addOns.length) setCustom(p);
    else add({ productId: p.id, addOnIds: [], qty: 1 });
  };
  const setQty = (i: number, qty: number) => setCart((c) => (qty <= 0 ? c.filter((_, j) => j !== i) : c.map((x, j) => (j === i ? { ...x, qty } : x))));

  const place = (thenPay: boolean) => {
    if (placing) return;
    setPlacing(true);
    try {
      const o = createOrder({ idempotencyKey: idem, items: cart, discount, type, tableId: type === "dine-in" ? tableId : undefined, customerName: custName, customerPhone: custPhone });
      toast.success(`Order ${o.number} saved`);
      setCart([]);
      setDiscKind("none");
      setDiscVal("");
      setCustName("");
      setCustPhone("");
      setTableId("");
      setIdem(newId());
      if (thenPay) setPayOrder(o);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="flex h-screen">
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-4 border-b border-border px-6 py-4">
          <h1 className="text-2xl font-semibold text-primary">New Order</h1>
          <div className="relative ml-auto w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products" className="w-full rounded-md border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-gold" />
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-border px-6 py-3">
          {[{ id: "all", name: "All" }, ...categories.filter((c) => !c.archived).sort((a, b) => a.sort - b.sort)].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition-colors ${cat === c.id ? "border-gold bg-primary text-primary-foreground" : "border-border bg-card hover:border-gold"}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto p-6 md:grid-cols-3 xl:grid-cols-4">
          {visible.map((p) => (
            <button key={p.id} onClick={() => onProduct(p)} disabled={!p.available} className="group overflow-hidden rounded-lg border border-border bg-card text-left shadow-card transition hover:border-gold disabled:opacity-50">
              <div className="relative aspect-[4/3] bg-muted">
                {imageFor(p.image) && <img src={imageFor(p.image)} alt={p.name} loading="lazy" className="h-full w-full object-cover" />}
                {!p.available && <span className="absolute inset-x-0 bottom-0 bg-destructive py-1 text-center text-xs font-semibold text-destructive-foreground">Unavailable</span>}
              </div>
              <div className="p-3">
                <div className="flex items-start gap-1.5">
                  {p.veg ? <Leaf className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <Drumstick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
                  <span className="text-sm font-medium leading-tight">{p.name}</span>
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-semibold text-primary">{formatINR(p.price)}</span>
                  {(p.variants.length > 0 || p.addOns.length > 0) && <span className="text-[10px] uppercase tracking-wide text-gold">Options</span>}
                </div>
              </div>
            </button>
          ))}
          {!visible.length && <p className="col-span-full text-center text-muted-foreground">No products match.</p>}
        </div>
      </section>

      <aside className="flex w-96 shrink-0 flex-col border-l border-border bg-card">
        <div className="space-y-3 border-b border-border p-4">
          <div className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {(["takeaway", "dine-in", ...(settings.deliveryEnabled ? ["delivery"] : [])] as OrderType[]).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`rounded py-1.5 text-sm capitalize ${type === t ? "bg-primary text-primary-foreground" : ""}`}>
                {t}
              </button>
            ))}
          </div>
          {type === "dine-in" && (
            <select value={tableId} onChange={(e) => setTableId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
              <option value="">Select table…</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.seats} seats){busyTables.has(t.id) ? " — occupied" : ""}
                </option>
              ))}
            </select>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer name (optional)" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
            <input value={custPhone} onChange={(e) => setCustPhone(e.target.value.replace(/[^\d+]/g, ""))} placeholder="Phone (optional)" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </div>
          {type === "takeaway" && settings.takeawayPrepMinutes > 0 && <p className="text-xs text-muted-foreground">Est. ready in ~{settings.takeawayPrepMinutes} min</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!cart.length ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <ShoppingBag className="mb-2 h-10 w-10 text-gold" />
              <p className="font-display text-xl text-primary">Cart is empty</p>
              <p className="text-sm">Tap a product to add it.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {cart.map((c, i) => {
                const l = lines[i];
                if (!l) return null;
                return (
                  <li key={i} className="rounded-md border border-border p-3">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{l.name}{l.variant ? ` · ${l.variant.name}` : ""}</div>
                        {l.addOns.length > 0 && <div className="text-xs text-muted-foreground">+ {l.addOns.map((a) => a.name).join(", ")}</div>}
                        {l.note && <div className="text-xs italic text-muted-foreground">“{l.note}”</div>}
                      </div>
                      <span className="text-sm font-semibold">{formatINR(lineTotal(l))}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button aria-label="Decrease" onClick={() => setQty(i, c.qty - 1)} className="rounded border border-border p-1"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-6 text-center text-sm font-semibold">{c.qty}</span>
                      <button aria-label="Increase" onClick={() => setQty(i, c.qty + 1)} className="rounded border border-border p-1"><Plus className="h-3.5 w-3.5" /></button>
                      <button aria-label="Add note" onClick={() => { const n = prompt("Special instructions", c.note ?? ""); if (n !== null) setCart((x) => x.map((y, j) => (j === i ? { ...y, note: n.trim() || undefined } : y))); }} className="ml-auto text-muted-foreground hover:text-primary"><StickyNote className="h-4 w-4" /></button>
                      <button aria-label="Remove" onClick={() => setQty(i, 0)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </div>

        <div className="space-y-2 border-t border-border p-4 text-sm">
          <div className="flex gap-2">
            <select value={discKind} onChange={(e) => setDiscKind(e.target.value as typeof discKind)} className="rounded-md border border-input bg-background px-2 py-1.5">
              <option value="none">No discount</option>
              <option value="percent">% off</option>
              <option value="fixed">₹ off</option>
            </select>
            {discKind !== "none" && <input inputMode="decimal" value={discVal} onChange={(e) => setDiscVal(e.target.value.replace(/[^\d.]/g, ""))} placeholder={discKind === "percent" ? "e.g. 10" : "e.g. 50"} className="w-full rounded-md border border-input bg-background px-2 py-1.5" />}
          </div>
          {totals && (
            <>
              <Line k="Subtotal" v={formatINR(totals.subtotal)} />
              {totals.discount > 0 && <Line k="Discount" v={`− ${formatINR(totals.discount)}`} />}
              {totals.taxes.filter((t) => t.rateBp > 0).map((t) => (
                <Line key={t.name} k={`${t.name} ${t.rateBp / 100}%${settings.taxInclusive ? " (incl.)" : ""}`} v={formatINR(t.tax)} />
              ))}
              <div className="flex items-baseline justify-between border-t border-gold pt-2">
                <span className="font-display text-xl text-primary">Total</span>
                <span className="text-2xl font-bold text-primary">{formatINR(totals.total)}</span>
              </div>
            </>
          )}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button disabled={!cart.length || placing || !!error} onClick={() => place(false)} className="rounded-md border border-primary py-3 font-semibold text-primary disabled:opacity-40">
              Save order
            </button>
            <button disabled={!cart.length || placing || !!error} onClick={() => place(true)} className="rounded-md bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40">
              Save & Pay
            </button>
          </div>
        </div>
      </aside>

      {custom && <Customize product={custom} onClose={() => setCustom(null)} onAdd={(i) => { add(i); setCustom(null); }} />}
      {payOrder && <PaymentDialog orderId={payOrder.id} onClose={() => setPayOrder(null)} />}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{k}</span>
      <span className="text-foreground">{v}</span>
    </div>
  );
}

function Customize({ product, onClose, onAdd }: { product: Product; onClose: () => void; onAdd: (i: CartInput) => void }) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id);
  const [addOns, setAddOns] = useState<string[]>([]);
  const price = product.price + (product.variants.find((v) => v.id === variantId)?.priceDelta ?? 0) + product.addOns.filter((a) => addOns.includes(a.id)).reduce((s, a) => s + a.price, 0);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">{product.name}</DialogTitle>
        </DialogHeader>
        {product.variants.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-semibold">Size</div>
            <div className="flex gap-2">
              {product.variants.map((v) => (
                <button key={v.id} onClick={() => setVariantId(v.id)} className={`rounded-md border px-4 py-2 text-sm ${variantId === v.id ? "border-gold bg-primary text-primary-foreground" : "border-border"}`}>
                  {v.name} {v.priceDelta ? `+${formatINR(v.priceDelta)}` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        {product.addOns.length > 0 && (
          <div>
            <div className="mb-2 text-sm font-semibold">Add-ons</div>
            <div className="space-y-1">
              {product.addOns.map((a) => (
                <label key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" checked={addOns.includes(a.id)} onChange={(e) => setAddOns((x) => (e.target.checked ? [...x, a.id] : x.filter((y) => y !== a.id)))} />
                    {a.name}
                  </span>
                  <span>+{formatINR(a.price)}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <button onClick={() => onAdd({ productId: product.id, variantId, addOnIds: addOns, qty: 1 })} className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground">
          Add to order · {formatINR(price)}
        </button>
      </DialogContent>
    </Dialog>
  );
}
