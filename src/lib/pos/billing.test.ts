import { beforeEach, describe, expect, it } from "vitest";
import { calculateTotals, cashChange, lineTotal } from "./billing";
import { __setDB, createOrder, freshDB, getDB, login, recordPayment, saveStaff, setOrderStatus, canTransition } from "./store";
import type { CartLine } from "./types";

const line = (o: Partial<CartLine> = {}): CartLine => ({ key: "k", productId: "p", name: "X", unitPrice: 16000, addOns: [], qty: 1, taxRateBp: 500, taxCategoryName: "F&B", ...o });

describe("billing engine", () => {
  it("variant and add-on prices are included per unit", () => {
    expect(lineTotal(line({ qty: 2, variant: { id: "lg", name: "L", priceDelta: 4000 }, addOns: [{ id: "a", name: "shot", price: 3000 }] }))).toBe(46000);
  });
  it("exclusive 5% tax on ₹160", () => {
    const t = calculateTotals([line()], { kind: "none" }, false);
    expect(t.tax).toBe(800);
    expect(t.total).toBe(16800);
  });
  it("inclusive tax is extracted, total unchanged", () => {
    const t = calculateTotals([line({ unitPrice: 10500 })], { kind: "none" }, true);
    expect(t.tax).toBe(500);
    expect(t.total).toBe(10500);
  });
  it("percent discount applied before tax", () => {
    const t = calculateTotals([line({ unitPrice: 10000 })], { kind: "percent", bp: 1000 }, false);
    expect(t.discount).toBe(1000);
    expect(t.tax).toBe(450);
    expect(t.total).toBe(9450);
  });
  it("fixed discount never makes total negative", () => {
    const t = calculateTotals([line({ unitPrice: 5000 })], { kind: "fixed", amount: 99999 }, false);
    expect(t.discount).toBe(5000);
    expect(t.total).toBe(0);
  });
  it("rounds to whole paise without float drift", () => {
    const t = calculateTotals([line({ unitPrice: 3333, qty: 3 })], { kind: "none" }, false);
    expect(t.tax).toBe(500);
    expect(Number.isInteger(t.total)).toBe(true);
  });
  it("cash change", () => {
    expect(cashChange(16800, 20000)).toBe(3200);
    expect(() => cashChange(16800, 10000)).toThrow();
  });
});

describe("orders & payments", () => {
  beforeEach(() => {
    __setDB(freshDB());
    login("3333");
  });
  const items = [{ productId: "p1", addOnIds: [], qty: 2 }];

  it("server-side totals ignore client prices and use catalog", () => {
    const o = createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    expect(o.totals.subtotal).toBe(32000);
  });
  it("same idempotency key does not create a second order", () => {
    createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    expect(getDB().orders.length).toBe(1);
  });
  it("cashier cannot exceed 10% discount", () => {
    expect(() => createOrder({ idempotencyKey: "b", items, discount: { kind: "percent", bp: 2000 }, type: "takeaway" })).toThrow();
  });
  it("unavailable items cannot be ordered", () => {
    const d = getDB();
    __setDB({ ...d, products: d.products.map((p) => (p.id === "p1" ? { ...p, available: false } : p)) });
    expect(() => createOrder({ idempotencyKey: "c", items, discount: { kind: "none" }, type: "takeaway" })).toThrow();
  });
  it("prevents duplicate payments", () => {
    const o = createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    recordPayment(o.id, { idempotencyKey: "pay1", method: "cash", received: 40000, confirmed: true });
    recordPayment(o.id, { idempotencyKey: "pay1", method: "cash", received: 40000, confirmed: true });
    expect(getDB().orders[0]!.payments.length).toBe(1);
    expect(() => recordPayment(o.id, { idempotencyKey: "pay2", method: "cash", received: 40000, confirmed: true })).toThrow();
  });
  it("card payment needs terminal confirmation; unconfirmed UPI stays pending", () => {
    const o = createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    expect(() => recordPayment(o.id, { idempotencyKey: "x", method: "card", confirmed: false })).toThrow();
    expect(recordPayment(o.id, { idempotencyKey: "y", method: "upi", confirmed: false }).paymentStatus).toBe("pending");
  });
  it("cashier cannot cancel orders", () => {
    const o = createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    expect(() => setOrderStatus(o.id, "cancelled", "x")).toThrow();
  });
  it("status lifecycle only moves forward one step", () => {
    expect(canTransition("confirmed", "preparing")).toBe(true);
    expect(canTransition("confirmed", "completed")).toBe(false);
    expect(canTransition("completed", "cancelled")).toBe(false);
  });
  it("stock deducted exactly once on completion", () => {
    const d = getDB();
    __setDB({ ...d, products: d.products.map((p) => (p.id === "p1" ? { ...p, recipe: [{ itemId: "i1", qty: 18 }] } : p)) });
    const o = createOrder({ idempotencyKey: "a", items, discount: { kind: "none" }, type: "takeaway" });
    setOrderStatus(o.id, "preparing");
    setOrderStatus(o.id, "ready");
    setOrderStatus(o.id, "completed");
    expect(getDB().inventory.find((i) => i.id === "i1")!.stock).toBe(-36);
    expect(() => setOrderStatus(o.id, "completed")).toThrow();
  });
  it("admin cannot change own role", () => {
    login("1111");
    const me = getDB().staff.find((s) => s.id === "s-admin")!;
    expect(() => saveStaff({ ...me, role: "cashier" })).toThrow();
  });
});
