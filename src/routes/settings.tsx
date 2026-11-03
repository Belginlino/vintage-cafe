import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { Switch } from "@/components/ui/switch";
import { useDB, saveSettings, saveTaxCategory, saveTables, resetDemo, newId } from "@/lib/pos/store";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";
import type { PaymentMethod, Settings } from "@/lib/pos/types";

export const Route = createFileRoute("/settings")({
  head: () => meta("Settings", "Café details, tax, receipts, payments and tables."),
  component: () => (
    <AppShell perm="settings">
      <SettingsPage />
    </AppShell>
  ),
});

const inputCls = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function SettingsPage() {
  const current = useDB((d) => d.settings);
  const taxes = useDB((d) => d.taxCategories);
  const tables = useDB((d) => d.tables);
  const [s, setS] = useState<Settings>(current);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));
  const run = (fn: () => void, ok = "Saved") => { try { fn(); toast.success(ok); } catch (e) { toast.error(errMsg(e)); } };

  return (
    <div>
      <PageHeader title="Settings" actions={<button onClick={() => run(() => saveSettings(s))} className="rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">Save settings</button>} />
      <div className="grid gap-6 p-8 lg:grid-cols-2">
        <Card title="Café details">
          <label>Café name<input className={inputCls} value={s.cafeName} onChange={(e) => set("cafeName", e.target.value)} /></label>
          <label>Tagline<input className={inputCls} value={s.tagline} onChange={(e) => set("tagline", e.target.value)} /></label>
          <label>Address<textarea className={inputCls} value={s.address} onChange={(e) => set("address", e.target.value)} /></label>
          <label>Phone<input className={inputCls} value={s.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          <label>Email<input className={inputCls} value={s.email} onChange={(e) => set("email", e.target.value)} /></label>
          <label>Tax registration (GSTIN), if any<input className={inputCls} value={s.taxRegistration} onChange={(e) => set("taxRegistration", e.target.value)} /></label>
        </Card>
        <Card title="Tax">
          <p className="text-xs text-muted-foreground">Rates here are demo defaults. Confirm the correct tax treatment for your business with your accountant.</p>
          <label className="flex items-center gap-2"><Switch checked={s.taxInclusive} onCheckedChange={(v) => set("taxInclusive", v)} /> Menu prices include tax</label>
          {taxes.map((t) => (
            <div key={t.id} className="flex items-center gap-2">
              <input className={inputCls} defaultValue={t.name} onBlur={(e) => run(() => saveTaxCategory({ ...t, name: e.target.value }))} />
              <input className={`${inputCls} w-24`} defaultValue={t.rateBp / 100} onBlur={(e) => run(() => saveTaxCategory({ ...t, rateBp: Math.round(parseFloat(e.target.value || "0") * 100) }))} />
              <span>%</span>
            </div>
          ))}
          <button onClick={() => run(() => saveTaxCategory({ id: newId(), name: "New tax", rateBp: 0 }))} className="text-sm text-primary underline">Add tax category</button>
          <label>Max cashier discount (%)<input className={inputCls} value={s.maxCashierDiscountBp / 100} onChange={(e) => set("maxCashierDiscountBp", Math.round(parseFloat(e.target.value || "0") * 100))} /></label>
        </Card>
        <Card title="Payments">
          {(["cash", "upi", "card", "other"] as PaymentMethod[]).map((m) => (
            <label key={m} className="flex items-center gap-2 uppercase"><Switch checked={s.paymentMethods[m]} onCheckedChange={(v) => set("paymentMethods", { ...s.paymentMethods, [m]: v })} /> {m}</label>
          ))}
          <label>Café UPI ID<input className={inputCls} value={s.upiId} onChange={(e) => set("upiId", e.target.value)} placeholder="e.g. cafe@bank" /></label>
          <label>UPI instructions<input className={inputCls} value={s.upiInstructions} onChange={(e) => set("upiInstructions", e.target.value)} /></label>
        </Card>
        <Card title="Orders & receipts">
          <label>Order number prefix<input className={inputCls} value={s.orderPrefix} onChange={(e) => set("orderPrefix", e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 4))} /></label>
          <label>Receipt width<select className={inputCls} value={s.receiptWidth} onChange={(e) => set("receiptWidth", e.target.value as "58" | "80")}><option value="80">80 mm</option><option value="58">58 mm</option></select></label>
          <label>Receipt footer<input className={inputCls} value={s.receiptFooter} onChange={(e) => set("receiptFooter", e.target.value)} /></label>
          <label>Takeaway prep time (min)<input type="number" className={inputCls} value={s.takeawayPrepMinutes} onChange={(e) => set("takeawayPrepMinutes", +e.target.value)} /></label>
          <label className="flex items-center gap-2"><Switch checked={s.deliveryEnabled} onCheckedChange={(v) => set("deliveryEnabled", v)} /> Enable delivery orders</label>
        </Card>
        <Card title="Tables">
          <div className="flex flex-wrap gap-2">{tables.map((t) => <span key={t.id} className="rounded border border-border px-2 py-1">{t.name} · {t.seats}</span>)}</div>
          <div className="flex gap-2">
            <button onClick={() => run(() => saveTables([...tables, { id: newId(), name: `T${tables.length + 1}`, seats: 4 }]))} className="text-sm text-primary underline">Add table</button>
            {tables.length > 0 && <button onClick={() => run(() => saveTables(tables.slice(0, -1)))} className="text-sm text-destructive underline">Remove last</button>}
          </div>
        </Card>
        <Card title="Demo data">
          <p className="text-xs text-muted-foreground">This app currently runs in local demo mode: data is stored in this browser only.</p>
          <button onClick={() => { if (confirm("Erase all orders and restore demo data?")) run(() => { resetDemo(); location.href = "/"; }, "Reset"); }} className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive">Reset demo data</button>
        </Card>
      </div>
    </div>
  );
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-6 text-sm shadow-card">
      <h2 className="text-2xl text-primary">{title}</h2>
      {children}
    </div>
  );
}
