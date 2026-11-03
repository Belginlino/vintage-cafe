import type { CartLine, Discount, Paise } from "./types";

/**
 * Central billing engine. All money is integer paise.
 * Order of operations:
 *  1. line total = (base + variant delta + Σ add-ons) × qty
 *  2. subtotal = Σ line totals
 *  3. discount (fixed or %) computed on subtotal, clamped to [0, subtotal],
 *     then allocated pro-rata across tax groups (largest-remainder)
 *  4. tax per tax group on the discounted amount:
 *     - exclusive: tax = taxable × rate, added on top
 *     - inclusive: tax = taxable − taxable / (1 + rate), already in price
 *  5. grand total = exclusive ? taxable + tax : taxable
 */

export interface TaxLine {
  name: string;
  rateBp: number;
  taxable: Paise;
  tax: Paise;
}
export interface Totals {
  subtotal: Paise;
  discount: Paise;
  taxable: Paise;
  taxes: TaxLine[];
  tax: Paise;
  total: Paise;
}

const roundHalfUp = (n: number) => Math.round(n + Number.EPSILON * Math.sign(n));

export function unitPriceOf(line: Pick<CartLine, "unitPrice" | "variant" | "addOns">): Paise {
  return line.unitPrice + (line.variant?.priceDelta ?? 0) + line.addOns.reduce((s, a) => s + a.price, 0);
}

export function lineTotal(line: Pick<CartLine, "unitPrice" | "variant" | "addOns" | "qty">): Paise {
  return unitPriceOf(line) * line.qty;
}

export function discountAmount(subtotal: Paise, d: Discount): Paise {
  let amt = 0;
  if (d.kind === "fixed") amt = d.amount;
  if (d.kind === "percent") amt = roundHalfUp((subtotal * d.bp) / 10000);
  return Math.max(0, Math.min(subtotal, Math.floor(amt)));
}

export function calculateTotals(lines: CartLine[], discount: Discount, taxInclusive: boolean): Totals {
  for (const l of lines) {
    if (!Number.isInteger(l.qty) || l.qty <= 0) throw new Error("Invalid quantity");
    if (!Number.isInteger(unitPriceOf(l)) || unitPriceOf(l) < 0) throw new Error("Invalid price");
  }
  const groups = new Map<string, { name: string; rateBp: number; gross: number }>();
  for (const l of lines) {
    const k = `${l.taxCategoryName}|${l.taxRateBp}`;
    const g = groups.get(k) ?? { name: l.taxCategoryName, rateBp: l.taxRateBp, gross: 0 };
    g.gross += lineTotal(l);
    groups.set(k, g);
  }
  const subtotal = [...groups.values()].reduce((s, g) => s + g.gross, 0);
  const disc = discountAmount(subtotal, discount);

  // allocate discount pro-rata, largest remainder
  const arr = [...groups.values()];
  const shares = arr.map((g) => (subtotal ? (disc * g.gross) / subtotal : 0));
  const floors = shares.map(Math.floor);
  let rem = disc - floors.reduce((a, b) => a + b, 0);
  const order = shares.map((s, i) => [s - floors[i]!, i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rem <= 0) break;
    floors[i]! += 1;
    rem -= 1;
  }

  const taxes: TaxLine[] = arr.map((g, i) => {
    const taxable = g.gross - floors[i]!;
    const tax = taxInclusive
      ? taxable - roundHalfUp((taxable * 10000) / (10000 + g.rateBp))
      : roundHalfUp((taxable * g.rateBp) / 10000);
    return { name: g.name, rateBp: g.rateBp, taxable, tax };
  });
  const taxable = subtotal - disc;
  const tax = taxes.reduce((s, t) => s + t.tax, 0);
  const total = taxInclusive ? taxable : taxable + tax;
  return { subtotal, discount: disc, taxable, taxes, tax, total: Math.max(0, total) };
}

export function cashChange(total: Paise, received: Paise): Paise {
  if (received < total) throw new Error("Insufficient cash received");
  return received - total;
}

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });
export const formatINR = (p: Paise) => inr.format(p / 100);
export const toPaise = (rupees: string | number) => {
  const n = typeof rupees === "number" ? rupees : parseFloat(rupees);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
