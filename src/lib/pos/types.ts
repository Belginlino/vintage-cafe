export type Role = "admin" | "manager" | "cashier" | "kitchen";
export type Paise = number; // integer money, 1 INR = 100 paise

export interface Staff {
  id: string;
  name: string;
  role: Role;
  pin: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  sort: number;
  archived?: boolean | undefined;
}

export interface Variant {
  id: string;
  name: string;
  priceDelta: Paise;
}
export interface AddOn {
  id: string;
  name: string;
  price: Paise;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  price: Paise;
  costPrice?: Paise | undefined;
  image?: string | undefined;
  available: boolean;
  archived: boolean;
  sku: string;
  taxCategoryId: string;
  veg: boolean;
  variants: Variant[];
  addOns: AddOn[];
  prepMinutes?: number | undefined;
  recipe?: { itemId: string | undefined; qty: number }[];
}

export interface TaxCategory {
  id: string;
  name: string;
  rateBp: number; // basis points: 500 = 5%
}

export type OrderType = "dine-in" | "takeaway" | "delivery";
export type OrderStatus = "new" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "upi" | "card" | "other";
export type PaymentStatus = "unpaid" | "pending" | "paid";

export interface CartLine {
  key: string;
  productId: string;
  name: string;
  unitPrice: Paise;
  variant?: Variant | undefined;
  addOns: AddOn[];
  qty: number;
  taxRateBp: number;
  taxCategoryName: string;
  note?: string | undefined;
}

export type Discount = { kind: "none" } | { kind: "fixed"; amount: Paise } | { kind: "percent"; bp: number };

export interface Payment {
  id: string;
  method: PaymentMethod;
  amount: Paise;
  received?: Paise | undefined;
  change?: Paise | undefined;
  reference?: string | undefined;
  status: "pending" | "verified";
  recordedBy: string;
  at: string;
}

export interface Order {
  id: string;
  number: string;
  idempotencyKey: string;
  type: OrderType;
  tableId?: string | undefined;
  tableName?: string | undefined;
  customerId?: string | undefined;
  customerName?: string | undefined;
  customerPhone?: string | undefined;
  lines: CartLine[]; // snapshots
  discount: Discount;
  taxInclusive: boolean;
  totals: import("./billing").Totals;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  payments: Payment[];
  cashier: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: { status: OrderStatus; at: string; by: string }[];
  cancelReason?: string | undefined;
  stockDeducted?: boolean | undefined;
}

export interface CafeTable {
  id: string;
  name: string;
  seats: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | undefined;
  notes?: string | undefined;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  unit: string;
  stock: number;
  minStock: number;
}

export interface StockMovement {
  id: string;
  itemId: string;
  kind: "opening" | "received" | "adjustment" | "sale";
  qty: number; // signed
  note?: string | undefined;
  orderId?: string | undefined;
  by: string;
  at: string;
}

export interface AuditLog {
  id: string;
  at: string;
  by: string;
  action: string;
  detail: string;
}

export interface Settings {
  cafeName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  taxRegistration: string;
  taxInclusive: boolean;
  receiptFooter: string;
  receiptWidth: "58" | "80";
  orderPrefix: string;
  paymentMethods: Record<PaymentMethod, boolean>;
  upiId: string;
  upiInstructions: string;
  deliveryEnabled: boolean;
  takeawayPrepMinutes: number;
  maxCashierDiscountBp: number;
}
