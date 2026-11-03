import type { Category, Order } from "./types";
import { lineTotal } from "./billing";

export function inRange(o: Order, from: Date, to: Date) {
  const t = new Date(o.createdAt).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function summarize(orders: Order[], categories: Category[], productCat: Record<string, string>) {
  const valid = orders.filter((o) => o.status !== "cancelled");
  const paid = valid.filter((o) => o.paymentStatus === "paid");
  const sum = (xs: Order[], f: (o: Order) => number) => xs.reduce((s, o) => s + f(o), 0);
  const byProduct = new Map<string, { name: string; qty: number; amount: number }>();
  const byCat = new Map<string, number>();
  for (const o of valid)
    for (const l of o.lines) {
      const p = byProduct.get(l.productId) ?? { name: l.name, qty: 0, amount: 0 };
      p.qty += l.qty;
      p.amount += lineTotal(l);
      byProduct.set(l.productId, p);
      const c = categories.find((c) => c.id === productCat[l.productId])?.name ?? "Other";
      byCat.set(c, (byCat.get(c) ?? 0) + lineTotal(l));
    }
  const byMethod = new Map<string, number>();
  for (const o of paid) for (const p of o.payments.filter((p) => p.status === "verified")) byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + p.amount);
  const taxes = new Map<string, number>();
  for (const o of valid) for (const t of o.totals.taxes) taxes.set(`${t.name} ${t.rateBp / 100}%`, (taxes.get(`${t.name} ${t.rateBp / 100}%`) ?? 0) + t.tax);
  return {
    count: valid.length,
    gross: sum(valid, (o) => o.totals.total),
    paid: sum(paid, (o) => o.totals.total),
    pending: sum(valid.filter((o) => o.paymentStatus !== "paid"), (o) => o.totals.total),
    avg: valid.length ? Math.round(sum(valid, (o) => o.totals.total) / valid.length) : 0,
    discount: sum(valid, (o) => o.totals.discount),
    tax: sum(valid, (o) => o.totals.tax),
    cancelled: orders.filter((o) => o.status === "cancelled"),
    products: [...byProduct.values()].sort((a, b) => b.qty - a.qty),
    categories: [...byCat.entries()].sort((a, b) => b[1] - a[1]),
    methods: [...byMethod.entries()],
    taxes: [...taxes.entries()],
  };
}
