import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { Switch } from "@/components/ui/switch";
import { useDB, saveStaff, newId } from "@/lib/pos/store";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";
import type { Role, Staff } from "@/lib/pos/types";

export const Route = createFileRoute("/staff")({
  head: () => meta("Staff & Roles", "Manage staff accounts, PINs and roles."),
  component: () => (
    <AppShell perm="staff">
      <StaffPage />
    </AppShell>
  ),
});

const roles: Role[] = ["admin", "manager", "cashier", "kitchen"];

function StaffPage() {
  const staff = useDB((d) => d.staff);
  const run = (s: Staff) => { try { saveStaff(s); toast.success("Saved"); } catch (e) { toast.error(errMsg(e)); } };
  return (
    <div>
      <PageHeader
        title="Staff & Roles"
        subtitle="Admins manage everything · Managers run menu, stock, reports · Cashiers bill · Kitchen sees tickets only."
        actions={<button onClick={() => { const name = prompt("Name"); const pin = name && prompt("4–6 digit PIN"); if (name && pin) run({ id: newId(), name, pin, role: "cashier", active: true }); }} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Add staff</button>}
      />
      <div className="p-8">
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          {staff.map((s) => (
            <div key={s.id} className="flex items-center gap-4 border-b border-border p-4 last:border-0">
              <span className="flex-1 font-medium">{s.name}</span>
              <select value={s.role} onChange={(e) => run({ ...s, role: e.target.value as Role })} className="rounded-md border border-input bg-background px-2 py-1 text-sm capitalize">
                {roles.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button onClick={() => { const p = prompt("New PIN"); if (p) run({ ...s, pin: p }); }} className="text-sm text-primary underline">Reset PIN</button>
              <label className="flex items-center gap-2 text-sm"><Switch checked={s.active} onCheckedChange={(v) => run({ ...s, active: v })} /> Active</label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
