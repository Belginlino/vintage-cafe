import type { Role } from "./types";

export type Permission =
  | "pos"
  | "orders.view"
  | "orders.cancel"
  | "kitchen"
  | "menu.manage"
  | "inventory.manage"
  | "customers"
  | "reports"
  | "settings"
  | "staff"
  | "audit"
  | "discount.unlimited"
  | "payment.verify";

const matrix: Record<Role, Permission[]> = {
  admin: ["pos", "orders.view", "orders.cancel", "kitchen", "menu.manage", "inventory.manage", "customers", "reports", "settings", "staff", "audit", "discount.unlimited", "payment.verify"],
  manager: ["pos", "orders.view", "orders.cancel", "kitchen", "menu.manage", "inventory.manage", "customers", "reports", "audit", "discount.unlimited", "payment.verify"],
  cashier: ["pos", "orders.view", "customers", "payment.verify"],
  kitchen: ["kitchen"],
};

export const can = (role: Role | undefined, p: Permission) => !!role && matrix[role].includes(p);
