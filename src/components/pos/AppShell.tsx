import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, ShoppingBag, ClipboardList, ChefHat, BookOpen, Package, Users, BarChart3,
  Settings, LogOut, Armchair, ShieldCheck, ScrollText,
} from "lucide-react";
import { useDB, logout } from "@/lib/pos/store";
import { can, type Permission } from "@/lib/pos/permissions";
import { Wordmark } from "./Wordmark";

const nav: { to: string; label: string; icon: typeof LayoutDashboard; perm: Permission }[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, perm: "reports" },
  { to: "/pos", label: "New Order", icon: ShoppingBag, perm: "pos" },
  { to: "/orders", label: "Orders", icon: ClipboardList, perm: "orders.view" },
  { to: "/kitchen", label: "Kitchen", icon: ChefHat, perm: "kitchen" },
  { to: "/tables", label: "Tables", icon: Armchair, perm: "pos" },
  { to: "/menu", label: "Menu", icon: BookOpen, perm: "menu.manage" },
  { to: "/inventory", label: "Inventory", icon: Package, perm: "inventory.manage" },
  { to: "/customers", label: "Customers", icon: Users, perm: "customers" },
  { to: "/reports", label: "Reports", icon: BarChart3, perm: "reports" },
  { to: "/staff", label: "Staff", icon: ShieldCheck, perm: "staff" },
  { to: "/audit", label: "Audit Log", icon: ScrollText, perm: "audit" },
  { to: "/settings", label: "Settings", icon: Settings, perm: "settings" },
];

export function firstAllowedPath(role: Parameters<typeof can>[0]) {
  return nav.find((n) => can(role, n.perm))?.to ?? "/";
}

export function AppShell({ perm, children }: { perm: Permission; children: ReactNode }) {
  const me = useDB((d) => d.staff.find((s) => s.id === d.sessionStaffId && s.active) ?? null);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  useEffect(() => {
    if (hydrated && !me) navigate({ to: "/" });
  }, [hydrated, me, navigate]);

  if (!hydrated || !me) return <div className="min-h-screen bg-background" />;

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-royal text-sidebar-foreground print:hidden">
        <div className="px-5 pb-4 pt-6">
          <Wordmark tone="dark" />
        </div>
        <div className="gold-rule mx-5 opacity-60" />
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
          {nav.filter((n) => can(me.role, n.perm)).map((n) => {
            const active = path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2 text-sm transition-colors ${
                  active ? "border-gold bg-sidebar-accent text-champagne" : "border-transparent text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-champagne"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="text-sm text-champagne">{me.name}</div>
          <div className="mb-3 text-xs capitalize text-sidebar-foreground/60">{me.role} · Demo mode</div>
          <button
            onClick={() => {
              logout();
              navigate({ to: "/" });
            }}
            className="flex items-center gap-2 text-xs text-sidebar-foreground/80 hover:text-champagne"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        {can(me.role, perm) ? (
          children
        ) : (
          <div className="p-10">
            <h1 className="text-3xl text-primary">Not permitted</h1>
            <p className="mt-2 text-muted-foreground">Your role ({me.role}) can't open this page.</p>
          </div>
        )}
      </main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-8 pb-5 pt-7">
      <div>
        <h1 className="text-3xl font-semibold text-primary">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
