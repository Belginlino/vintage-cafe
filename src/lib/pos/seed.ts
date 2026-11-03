import type { Category, Product, Settings, Staff, TaxCategory, CafeTable, InventoryItem } from "./types";

export const seedStaff: Staff[] = [
  { id: "s-admin", name: "Owner (Admin)", role: "admin", pin: "1111", active: true },
  { id: "s-mgr", name: "Floor Manager", role: "manager", pin: "2222", active: true },
  { id: "s-cash", name: "Cashier", role: "cashier", pin: "3333", active: true },
  { id: "s-kit", name: "Kitchen", role: "kitchen", pin: "4444", active: true },
];

export const seedTax: TaxCategory[] = [
  { id: "t-food", name: "Food & Beverages", rateBp: 500 },
  { id: "t-none", name: "Exempt", rateBp: 0 },
];

const cats = ["Hot Coffee", "Cold Coffee", "Tea", "Fresh Juices", "Milkshakes", "Sandwiches", "Burgers", "Snacks", "Desserts", "Signature Specials", "Combos"];
export const seedCategories: Category[] = cats.map((name, i) => ({ id: `c${i + 1}`, name, sort: i }));

const sizes = [
  { id: "reg", name: "Regular", priceDelta: 0 },
  { id: "lg", name: "Large", priceDelta: 4000 },
];
const milkAdd = [
  { id: "shot", name: "Extra shot", price: 3000 },
  { id: "oat", name: "Oat milk", price: 4000 },
  { id: "syrup", name: "Hazelnut syrup", price: 2500 },
];
const cheese = [{ id: "cheese", name: "Extra cheese", price: 3000 }];

type P = [string, string, number, string, boolean, ("size" | "milk" | "cheese")[]?];
const raw: P[] = [
  ["c1", "Cappuccino", 160, "hot-coffee", true, ["size", "milk"]],
  ["c1", "Café Latte", 170, "hot-coffee", true, ["size", "milk"]],
  ["c1", "Americano", 140, "hot-coffee", true, ["size", "milk"]],
  ["c1", "Espresso", 110, "hot-coffee", true],
  ["c2", "Classic Cold Coffee", 180, "cold-coffee", true, ["size", "milk"]],
  ["c2", "Iced Mocha", 210, "cold-coffee", true, ["size", "milk"]],
  ["c2", "Cold Brew", 220, "cold-coffee", true, ["size"]],
  ["c3", "Masala Chai", 70, "tea", true, ["size"]],
  ["c3", "Earl Grey", 120, "tea", true],
  ["c3", "Lemon Iced Tea", 130, "tea", true, ["size"]],
  ["c4", "Fresh Orange", 150, "juice", true, ["size"]],
  ["c4", "Watermelon Cooler", 140, "juice", true, ["size"]],
  ["c5", "Strawberry Shake", 190, "juice", true, ["size"]],
  ["c5", "Chocolate Shake", 200, "juice", true, ["size"]],
  ["c6", "Club Sandwich", 240, "savory", false, ["cheese"]],
  ["c6", "Veg Grilled Sandwich", 180, "savory", true, ["cheese"]],
  ["c7", "Vintage Chicken Burger", 260, "savory", false, ["cheese"]],
  ["c7", "Paneer Tikka Burger", 230, "savory", true, ["cheese"]],
  ["c8", "French Fries", 120, "savory", true],
  ["c8", "Peri Peri Fries", 140, "savory", true],
  ["c9", "Chocolate Lava Cake", 190, "dessert", true],
  ["c9", "Berry Cheesecake", 220, "dessert", true],
  ["c10", "Royal Saffron Latte", 240, "hot-coffee", true, ["size"]],
  ["c10", "Rose Cardamom Cold Brew", 250, "cold-coffee", true],
  ["c11", "Burger + Fries + Cold Coffee", 480, "savory", false],
  ["c11", "Sandwich + Chai", 230, "savory", true],
];

export const seedProducts: Product[] = raw.map(([cat, name, rupees, image, veg, opts], i) => ({
  id: `p${i + 1}`,
  name,
  description: "Demo item — replace with your menu.",
  categoryId: cat,
  price: rupees * 100,
  image,
  available: true,
  archived: false,
  sku: `VC-${String(i + 1).padStart(3, "0")}`,
  taxCategoryId: "t-food",
  veg,
  variants: opts?.includes("size") ? sizes : [],
  addOns: [...(opts?.includes("milk") ? milkAdd : []), ...(opts?.includes("cheese") ? cheese : [])],
  prepMinutes: 8,
}));

export const seedTables: CafeTable[] = Array.from({ length: 8 }, (_, i) => ({ id: `tb${i + 1}`, name: `T${i + 1}`, seats: i < 4 ? 2 : 4 }));

export const seedInventory: InventoryItem[] = [
  { id: "i1", name: "Coffee beans", unit: "g", stock: 0, minStock: 1000 },
  { id: "i2", name: "Milk", unit: "ml", stock: 0, minStock: 5000 },
  { id: "i3", name: "Burger buns", unit: "pcs", stock: 0, minStock: 20 },
  { id: "i4", name: "Bread loaf", unit: "pcs", stock: 0, minStock: 5 },
];

export const seedSettings: Settings = {
  cafeName: "VINTAGE Cafe",
  tagline: "Timeless Indulgence",
  address: "",
  phone: "",
  email: "",
  taxRegistration: "",
  taxInclusive: false,
  receiptFooter: "Thank you for visiting. Come back soon!",
  receiptWidth: "80",
  orderPrefix: "V",
  paymentMethods: { cash: true, upi: true, card: true, other: false },
  upiId: "",
  upiInstructions: "",
  deliveryEnabled: false,
  takeawayPrepMinutes: 15,
  maxCashierDiscountBp: 1000,
};
