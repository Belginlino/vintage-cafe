import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Pencil, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/pos/AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useDB, saveProduct, saveCategory, newId } from "@/lib/pos/store";
import { formatINR, toPaise } from "@/lib/pos/billing";
import { imageFor } from "@/lib/pos/images";
import { errMsg } from "@/lib/pos/csv";
import { meta } from "@/lib/pos/meta";
import type { Product } from "@/lib/pos/types";

export const Route = createFileRoute("/menu")({
  head: () => meta("Menu", "Manage products, prices, variants and categories."),
  component: () => (
    <AppShell perm="menu.manage">
      <Menu />
    </AppShell>
  ),
});

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Menu() {
  const products = useDB((d) => d.products);
  const categories = useDB((d) => d.categories);
  const [edit, setEdit] = useState<Product | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const run = (fn: () => void, ok?: string) => { try { fn(); if (ok) toast.success(ok); } catch (e) { toast.error(errMsg(e)); } };
  const blank = (): Product => ({ id: newId(), name: "", description: "", categoryId: categories[0]?.id ?? "", price: 0, available: true, archived: false, sku: "", taxCategoryId: "t-food", veg: true, variants: [], addOns: [] });

  return (
    <div>
      <PageHeader
        title="Menu"
        subtitle="Starter demo items and prices — replace with your own."
        actions={<>
          <label className="flex items-center gap-2 text-sm"><Switch checked={showArchived} onCheckedChange={setShowArchived} /> Show archived</label>
          <button onClick={() => { const n = prompt("New category name"); if (n?.trim()) run(() => saveCategory({ id: newId(), name: n.trim(), sort: categories.length }), "Category added"); }} className="rounded-md border border-primary px-4 py-2 text-sm text-primary">Add category</button>
          <button onClick={() => setEdit(blank())} className="flex items-center gap-1 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"><Plus className="h-4 w-4" /> Product</button>
        </>}
      />
      <div className="space-y-8 p-8">
        {categories.sort((a, b) => a.sort - b.sort).map((c) => {
          const items = products.filter((p) => p.categoryId === c.id && (showArchived || !p.archived));
          return (
            <section key={c.id}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="text-2xl text-primary">{c.name}</h2>
                <button onClick={() => { const n = prompt("Rename category", c.name); if (n?.trim()) run(() => saveCategory({ ...c, name: n.trim() })); }} className="text-muted-foreground hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
                <div className="gold-rule flex-1" />
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                {items.map((p) => (
                  <div key={p.id} className={`flex items-center gap-4 border-b border-border p-3 last:border-0 ${p.archived ? "opacity-50" : ""}`}>
                    {imageFor(p.image) ? <img src={imageFor(p.image)} alt="" className="h-12 w-12 rounded object-cover" /> : <div className="h-12 w-12 rounded bg-muted" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{p.name} <span className="text-xs text-muted-foreground">{p.sku}</span></div>
                      <div className="text-xs text-muted-foreground">{p.variants.length} variants · {p.addOns.length} add-ons · {p.veg ? "Veg" : "Non-veg"}</div>
                    </div>
                    <span className="w-24 text-right font-semibold">{formatINR(p.price)}</span>
                    <label className="flex items-center gap-2 text-xs"><Switch checked={p.available} onCheckedChange={(v) => run(() => saveProduct({ ...p, available: v }))} /> {p.available ? "Available" : "Off"}</label>
                    <button onClick={() => setEdit(p)} aria-label="Edit" className="text-muted-foreground hover:text-primary"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => run(() => saveProduct({ ...p, archived: !p.archived }), p.archived ? "Restored" : "Archived")} aria-label="Archive" className="text-muted-foreground hover:text-destructive"><Archive className="h-4 w-4" /></button>
                  </div>
                ))}
                {!items.length && <p className="p-4 text-sm text-muted-foreground">No products.</p>}
              </div>
            </section>
          );
        })}
      </div>
      {edit && <ProductForm product={edit} onClose={() => setEdit(null)} onSave={(p) => run(() => { saveProduct(p); setEdit(null); }, "Product saved")} />}
    </div>
  );
}

function ProductForm({ product, onClose, onSave }: { product: Product; onClose: () => void; onSave: (p: Product) => void }) {
  const categories = useDB((d) => d.categories);
  const taxes = useDB((d) => d.taxCategories);
  const [p, setP] = useState(product);
  const [price, setPrice] = useState(String(product.price / 100));
  const [cost, setCost] = useState(product.costPrice != null ? String(product.costPrice / 100) : "");
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const onImage = (f?: File) => {
    if (!f) return undefined;
    if (f.size > 400_000) { toast.error("Image must be under 400 KB in demo mode"); return undefined; }
    const r = new FileReader();
    r.onload = () => set("image", String(r.result));
    r.readAsDataURL(f);
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display text-2xl text-primary">{product.name || "New product"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2">Name<input className={inputCls} value={p.name} onChange={(e) => set("name", e.target.value)} /></label>
          <label className="col-span-2">Description<input className={inputCls} value={p.description} onChange={(e) => set("description", e.target.value)} /></label>
          <label>Category<select className={inputCls} value={p.categoryId} onChange={(e) => set("categoryId", e.target.value)}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Tax category<select className={inputCls} value={p.taxCategoryId} onChange={(e) => set("taxCategoryId", e.target.value)}>{taxes.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.rateBp / 100}%)</option>)}</select></label>
          <label>Selling price (₹)<input className={inputCls} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label>Cost price (₹, optional)<input className={inputCls} inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
          <label>SKU<input className={inputCls} value={p.sku} onChange={(e) => set("sku", e.target.value)} /></label>
          <label>Prep minutes<input className={inputCls} type="number" value={p.prepMinutes ?? ""} onChange={(e) => set("prepMinutes", e.target.value ? +e.target.value : undefined)} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={p.veg} onChange={(e) => set("veg", e.target.checked)} /> Vegetarian</label>
          <label>Image<input type="file" accept="image/*" className="text-xs" onChange={(e) => onImage(e.target.files?.[0])} /></label>
        </div>
        <OptionList title="Variants (price difference)" items={p.variants.map((v) => ({ id: v.id, name: v.name, amount: v.priceDelta }))} onChange={(xs) => set("variants", xs.map((x) => ({ id: x.id, name: x.name, priceDelta: x.amount })))} />
        <OptionList title="Add-ons (price)" items={p.addOns.map((a) => ({ id: a.id, name: a.name, amount: a.price }))} onChange={(xs) => set("addOns", xs.map((x) => ({ id: x.id, name: x.name, price: x.amount })))} />
        <button onClick={() => onSave({ ...p, price: toPaise(price), costPrice: cost ? toPaise(cost) : undefined })} className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground">Save product</button>
      </DialogContent>
    </Dialog>
  );
}

function OptionList({ title, items, onChange }: { title: string; items: { id: string; name: string; amount: number }[]; onChange: (x: { id: string; name: string; amount: number }[]) => void }) {
  return (
    <div className="text-sm">
      <div className="mb-1 flex items-center justify-between font-semibold">{title}<button onClick={() => onChange([...items, { id: newId(), name: "", amount: 0 }])} className="text-primary"><Plus className="h-4 w-4" /></button></div>
      {items.map((it, i) => (
        <div key={it.id} className="mb-1 flex gap-2">
          <input className={inputCls} placeholder="Name" value={it.name} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input className={`${inputCls} w-28`} placeholder="₹" defaultValue={it.amount / 100} onBlur={(e) => onChange(items.map((x, j) => (j === i ? { ...x, amount: toPaise(e.target.value) } : x)))} />
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  );
}
