import { useSyncExternalStore } from "react";
import { calculateTotals, cashChange, unitPriceOf } from "./billing";
import { can } from "./permissions";
import * as seed from "./seed";
import type {
  AuditLog, CafeTable, CartLine, Category, Customer, Discount, InventoryItem, Order, OrderStatus,
  OrderType, Payment, PaymentMethod, Product, Settings, Staff, StockMovement, TaxCategory,
} from "./types";

/**
 * Local demo data layer (browser storage). All writes go through these
 * repository functions, which re-validate prices, permissions and totals
 * instead of trusting UI state — the same contract a server backend would enforce.
 */
export interface DB {
  version: number;
  staff: Staff[];
  categories: Category[];
  products: Product[];
  taxCategories: TaxCategory[];
  tables: CafeTable[];
  customers: Customer[];
  orders: Order[];
  inventory: InventoryItem[];
  movements: StockMovement[];
  audit: AuditLog[];
  settings: Settings;
  counters: Record<string, number>;
  sessionStaffId: string | null;
}

const KEY = "vintage-pos-db-v1";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const now = () => new Date().toISOString();

export function freshDB(): DB {
  return {
    version: 1,
    staff: seed.seedStaff,
    categories: seed.seedCategories,
    products: seed.seedProducts,
    taxCategories: seed.seedTax,
    tables: seed.seedTables,
    customers: [],
    orders: [],
    inventory: seed.seedInventory,
    movements: [],
    audit: [],
    settings: seed.seedSettings,
    counters: {},
    sessionStaffId: null,
  };
}

let db: DB = freshDB();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) db = { ...freshDB(), ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt storage */
  }
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && e.newValue) {
      db = JSON.parse(e.newValue);
      listeners.forEach((l) => l());
    }
  });
}

function commit(next: DB) {
  db = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(db));
  listeners.forEach((l) => l());
}

export function getDB() {
  load();
  return db;
}
/** test helper */
export function __setDB(next: DB) {
  loaded = true;
  db = next;
}

const serverSnapshot = freshDB();
const subscribe = (cb: () => void) => {
  load();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
/** Subscribes to the stable DB snapshot; selectors may safely return new arrays/objects. */
export function useDB<T>(sel: (d: DB) => T): T {
  const snap = useSyncExternalStore(subscribe, getDB, () => serverSnapshot);
  return sel(snap);
}

export function currentStaff(d: DB = getDB()) {
  return d.staff.find((s) => s.id === d.sessionStaffId && s.active) ?? null;
}

function requireStaff(perm?: Parameters<typeof can>[1]) {
  const me = currentStaff();
  if (!me) throw new Error("Please sign in");
  if (perm && !can(me.role, perm)) throw new Error("You don't have permission for this action");
  return me;
}

function audit(d: DB, by: string, action: string, detail: string): DB {
  return { ...d, audit: [{ id: uid(), at: now(), by, action, detail }, ...d.audit].slice(0, 2000) };
}

// ---------- Auth ----------
export function login(pin: string) {
  const d = getDB();
  const s = d.staff.find((x) => x.pin === pin && x.active);
  if (!s) throw new Error("Incorrect PIN");
  commit(audit({ ...d, sessionStaffId: s.id }, s.name, "login", `${s.role} signed in`));
  return s;
}
export function logout() {
  const d = getDB();
  commit({ ...d, sessionStaffId: null });
}

// ---------- Orders ----------
export interface CartInput {
  productId: string;
  variantId?: string | undefined;
  addOnIds: string[];
  qty: number;
  note?: string | undefined;
}

/** Build trusted line snapshots from the catalog (never from UI-supplied prices). */
export function buildLines(d: DB, items: CartInput[]): CartLine[] {
  return items.map((it) => {
    const p = d.products.find((x) => x.id === it.productId);
    if (!p || p.archived) throw new Error("Product not found");
    if (!p.available) throw new Error(`${p.name} is unavailable`);
    const variant = it.variantId ? p.variants.find((v) => v.id === it.variantId) : undefined;
    if (it.variantId && !variant) throw new Error("Invalid variant");
    const addOns = it.addOnIds.map((id) => {
      const a = p.addOns.find((x) => x.id === id);
      if (!a) throw new Error("Invalid add-on");
      return a;
    });
    const tax = d.taxCategories.find((t) => t.id === p.taxCategoryId) ?? { name: "Exempt", rateBp: 0 };
    return {
      key: `${p.id}|${variant?.id ?? ""}|${addOns.map((a) => a.id).sort().join(",")}|${it.note ?? ""}`,
      productId: p.id,
      name: p.name,
      unitPrice: p.price,
      variant,
      addOns,
      qty: it.qty,
      taxRateBp: tax.rateBp,
      taxCategoryName: tax.name,
      note: it.note,
    };
  });
}

function nextOrderNumber(d: DB): [string, Record<string, number>] {
  const dt = new Date();
  const day = `${String(dt.getFullYear()).slice(2)}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
  const n = (d.counters[day] ?? 0) + 1;
  return [`${d.settings.orderPrefix}-${day}-${String(n).padStart(3, "0")}`, { ...d.counters, [day]: n }];
}

export interface CreateOrderInput {
  idempotencyKey: string;
  items: CartInput[];
  discount: Discount;
  type: OrderType;
  tableId?: string | undefined;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
}

export function createOrder(input: CreateOrderInput): Order {
  const me = requireStaff("pos");
  const d = getDB();
  const existing = d.orders.find((o) => o.idempotencyKey === input.idempotencyKey);
  if (existing) return existing;
  if (!input.items.length) throw new Error("Cart is empty");
  if (input.type === "delivery" && !d.settings.deliveryEnabled) throw new Error("Delivery is not enabled");
  if (input.type === "dine-in" && !input.tableId) throw new Error("Select a table for dine-in");
  if (input.discount.kind === "percent" && (input.discount.bp < 0 || input.discount.bp > 10000)) throw new Error("Invalid discount");
  if (input.discount.kind === "fixed" && input.discount.amount < 0) throw new Error("Invalid discount");
  const lines = buildLines(d, input.items);
  const totals = calculateTotals(lines, input.discount, d.settings.taxInclusive);
  if (!can(me.role, "discount.unlimited") && totals.subtotal > 0 && totals.discount * 10000 > totals.subtotal * d.settings.maxCashierDiscountBp) {
    throw new Error(`Discounts above ${d.settings.maxCashierDiscountBp / 100}% need a manager`);
  }
  const table = d.tables.find((t) => t.id === input.tableId);
  let customers = d.customers;
  let customerId: string | undefined;
  if (input.customerPhone) {
    const c = customers.find((x) => x.phone === input.customerPhone);
    if (c) customerId = c.id;
    else {
      customerId = uid();
      customers = [...customers, { id: customerId, name: input.customerName || "Guest", phone: input.customerPhone, createdAt: now() }];
    }
  }
  const [number, counters] = nextOrderNumber(d);
  const order: Order = {
    id: uid(),
    number,
    idempotencyKey: input.idempotencyKey,
    type: input.type,
    tableId: table?.id,
    tableName: table?.name,
    customerId,
    customerName: input.customerName || undefined,
    customerPhone: input.customerPhone || undefined,
    lines,
    discount: input.discount,
    taxInclusive: d.settings.taxInclusive,
    totals,
    status: "confirmed",
    paymentStatus: "unpaid",
    payments: [],
    cashier: me.name,
    createdAt: now(),
    updatedAt: now(),
    statusHistory: [{ status: "confirmed", at: now(), by: me.name }],
  };
  commit(audit({ ...d, orders: [order, ...d.orders], counters, customers }, me.name, "order.create", `${number} ${totals.total}`));
  return order;
}

export interface PaymentInput {
  idempotencyKey: string;
  method: PaymentMethod;
  received?: number | undefined;
  reference?: string | undefined;
  confirmed: boolean; // staff confirms terminal/UPI success
}

export function recordPayment(orderId: string, input: PaymentInput): Order {
  const me = requireStaff("pos");
  const d = getDB();
  const o = d.orders.find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found");
  if (o.payments.some((p) => p.id === input.idempotencyKey)) return o;
  if (o.status === "cancelled") throw new Error("Order is cancelled");
  if (o.paymentStatus === "paid") throw new Error("Order already paid");
  if (!d.settings.paymentMethods[input.method]) throw new Error("Payment method disabled");
  const amount = o.totals.total;
  let p: Payment = { id: input.idempotencyKey, method: input.method, amount, status: "pending", recordedBy: me.name, at: now(), reference: input.reference };
  if (input.method === "cash") {
    const received = input.received ?? 0;
    p = { ...p, received, change: cashChange(amount, received), status: "verified" };
  } else if (input.method === "card") {
    if (!input.confirmed) throw new Error("Confirm the card terminal approved the payment");
    p = { ...p, status: "verified" };
  } else {
    p = { ...p, status: input.confirmed ? "verified" : "pending" };
  }
  const updated: Order = { ...o, payments: [...o.payments.filter((x) => x.status === "verified"), p], paymentStatus: p.status === "verified" ? "paid" : "pending", updatedAt: now() };
  commit(audit({ ...d, orders: d.orders.map((x) => (x.id === o.id ? updated : x)) }, me.name, "payment.record", `${o.number} ${p.method} ${p.status}`));
  return updated;
}

export function verifyPayment(orderId: string, paymentId: string, reference?: string) {
  const me = requireStaff("payment.verify");
  const d = getDB();
  const o = d.orders.find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found");
  const updated: Order = {
    ...o,
    payments: o.payments.map((p) => (p.id === paymentId ? { ...p, status: "verified", reference: reference || p.reference } : p)),
    paymentStatus: "paid",
    updatedAt: now(),
  };
  commit(audit({ ...d, orders: d.orders.map((x) => (x.id === o.id ? updated : x)) }, me.name, "payment.verify", o.number));
}

const flow: OrderStatus[] = ["new", "confirmed", "preparing", "ready", "completed"];
export function canTransition(from: OrderStatus, to: OrderStatus) {
  if (to === "cancelled") return from !== "completed" && from !== "cancelled";
  const i = flow.indexOf(from);
  return i >= 0 && flow.indexOf(to) === i + 1;
}

function deductStock(d: DB, o: Order, by: string): DB {
  if (o.stockDeducted) return d;
  const moves: StockMovement[] = [];
  const inv = d.inventory.map((i) => ({ ...i }));
  for (const l of o.lines) {
    const p = d.products.find((x) => x.id === l.productId);
    for (const r of p?.recipe ?? []) {
      const item = inv.find((i) => i.id === r.itemId);
      if (!item) continue;
      const qty = -(r.qty * l.qty);
      item.stock += qty;
      moves.push({ id: uid(), itemId: item.id, kind: "sale", qty, orderId: o.id, by, at: now(), note: o.number });
    }
  }
  return { ...d, inventory: inv, movements: [...moves, ...d.movements], orders: d.orders.map((x) => (x.id === o.id ? { ...x, stockDeducted: true } : x)) };
}

export function setOrderStatus(orderId: string, to: OrderStatus, reason?: string) {
  const me = requireStaff(to === "cancelled" ? "orders.cancel" : undefined);
  if (to !== "cancelled" && !(can(me.role, "kitchen") || can(me.role, "pos"))) throw new Error("Not allowed");
  let d = getDB();
  const o = d.orders.find((x) => x.id === orderId);
  if (!o) throw new Error("Order not found");
  if (!canTransition(o.status, to)) throw new Error(`Cannot move from ${o.status} to ${to}`);
  if (to === "cancelled" && !reason?.trim()) throw new Error("A cancellation reason is required");
  const updated: Order = { ...o, status: to, cancelReason: reason, updatedAt: now(), statusHistory: [...o.statusHistory, { status: to, at: now(), by: me.name }] };
  d = { ...d, orders: d.orders.map((x) => (x.id === o.id ? updated : x)) };
  if (to === "completed") d = deductStock(d, updated, me.name);
  commit(audit(d, me.name, "order.status", `${o.number} → ${to}${reason ? ` (${reason})` : ""}`));
}

// ---------- Menu ----------
export function saveProduct(p: Product) {
  const me = requireStaff("menu.manage");
  const d = getDB();
  if (!p.name.trim()) throw new Error("Name is required");
  if (!Number.isInteger(p.price) || p.price < 0) throw new Error("Invalid price");
  const exists = d.products.some((x) => x.id === p.id);
  const products = exists ? d.products.map((x) => (x.id === p.id ? p : x)) : [...d.products, p];
  commit(audit({ ...d, products }, me.name, exists ? "product.update" : "product.create", `${p.name} ₹${p.price / 100}`));
}
export function newId() {
  return uid();
}
export function saveCategory(c: Category) {
  const me = requireStaff("menu.manage");
  const d = getDB();
  const exists = d.categories.some((x) => x.id === c.id);
  commit(audit({ ...d, categories: exists ? d.categories.map((x) => (x.id === c.id ? c : x)) : [...d.categories, c] }, me.name, "category.save", c.name));
}
export function saveTaxCategory(t: TaxCategory) {
  const me = requireStaff("settings");
  const d = getDB();
  const exists = d.taxCategories.some((x) => x.id === t.id);
  commit(audit({ ...d, taxCategories: exists ? d.taxCategories.map((x) => (x.id === t.id ? t : x)) : [...d.taxCategories, t] }, me.name, "tax.save", `${t.name} ${t.rateBp / 100}%`));
}

// ---------- Inventory ----------
export function saveInventoryItem(i: InventoryItem) {
  const me = requireStaff("inventory.manage");
  const d = getDB();
  const exists = d.inventory.some((x) => x.id === i.id);
  commit(audit({ ...d, inventory: exists ? d.inventory.map((x) => (x.id === i.id ? { ...i, stock: x.stock } : x)) : [...d.inventory, i] }, me.name, "inventory.item", i.name));
}
export function moveStock(itemId: string, kind: "opening" | "received" | "adjustment", qty: number, note: string) {
  const me = requireStaff("inventory.manage");
  const d = getDB();
  if (!Number.isFinite(qty) || qty === 0) throw new Error("Enter a quantity");
  if (kind === "adjustment" && !note.trim()) throw new Error("Adjustments need a reason");
  const m: StockMovement = { id: uid(), itemId, kind, qty, note, by: me.name, at: now() };
  commit(audit({ ...d, inventory: d.inventory.map((i) => (i.id === itemId ? { ...i, stock: i.stock + qty } : i)), movements: [m, ...d.movements] }, me.name, `stock.${kind}`, `${qty} ${note}`));
}

// ---------- Customers / tables / staff / settings ----------
export function saveCustomer(c: Customer) {
  const me = requireStaff("customers");
  const d = getDB();
  if (!c.name.trim() || !c.phone.trim()) throw new Error("Name and phone are required");
  const exists = d.customers.some((x) => x.id === c.id);
  commit(audit({ ...d, customers: exists ? d.customers.map((x) => (x.id === c.id ? c : x)) : [...d.customers, c] }, me.name, "customer.save", c.name));
}
export function saveTables(tables: CafeTable[]) {
  const me = requireStaff("settings");
  commit(audit({ ...getDB(), tables }, me.name, "tables.save", `${tables.length} tables`));
}
export function saveStaff(s: Staff) {
  const me = requireStaff("staff");
  const d = getDB();
  const prev = d.staff.find((x) => x.id === s.id);
  if (prev && s.id === me.id && (s.role !== prev.role || !s.active)) throw new Error("You cannot change your own role or deactivate yourself");
  if (!/^\d{4,6}$/.test(s.pin)) throw new Error("PIN must be 4–6 digits");
  if (d.staff.some((x) => x.pin === s.pin && x.id !== s.id)) throw new Error("PIN already in use");
  commit(audit({ ...d, staff: prev ? d.staff.map((x) => (x.id === s.id ? s : x)) : [...d.staff, s] }, me.name, "staff.save", `${s.name} (${s.role})`));
}
export function saveSettings(s: Settings) {
  const me = requireStaff("settings");
  commit(audit({ ...getDB(), settings: s }, me.name, "settings.update", "Settings changed"));
}
export function resetDemo() {
  requireStaff("settings");
  commit(freshDB());
}
