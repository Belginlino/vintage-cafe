import { useState } from "react";
import { Banknote, CreditCard, QrCode, Wallet, Printer } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDB, recordPayment, newId } from "@/lib/pos/store";
import { formatINR, toPaise } from "@/lib/pos/billing";
import { errMsg } from "@/lib/pos/csv";
import type { PaymentMethod } from "@/lib/pos/types";
import { Receipt } from "./Receipt";

const icons = { cash: Banknote, upi: QrCode, card: CreditCard, other: Wallet };

export function PaymentDialog({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const order = useDB((d) => d.orders.find((o) => o.id === orderId));
  const settings = useDB((d) => d.settings);
  const methods = (Object.keys(settings.paymentMethods) as PaymentMethod[]).filter((m) => settings.paymentMethods[m]);
  const [method, setMethod] = useState<PaymentMethod>(methods[0] ?? "cash");
  const [received, setReceived] = useState("");
  const [ref, setRef] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [idem] = useState(newId);
  if (!order) return null;
  const total = order.totals.total;
  const rec = toPaise(received);
  const done = order.paymentStatus !== "unpaid";

  const submit = () => {
    if (busy) return;
    setBusy(true);
    try {
      const o = recordPayment(order.id, { idempotencyKey: idem, method, received: rec, reference: ref || undefined, confirmed });
      toast.success(o.paymentStatus === "paid" ? "Payment recorded" : "Payment marked pending verification");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-primary">
            {done ? "Receipt" : "Payment"} · {order.number}
          </DialogTitle>
        </DialogHeader>
        {done ? (
          <>
            <div className="max-h-[60vh] overflow-y-auto rounded-md border border-gold/40">
              <Receipt order={order} settings={settings} />
            </div>
            <button onClick={() => window.print()} className="flex w-full items-center justify-center gap-2 rounded-md bg-primary py-3 font-semibold text-primary-foreground">
              <Printer className="h-4 w-4" /> Print / Save PDF
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md bg-muted p-4 text-center">
              <div className="text-sm text-muted-foreground">Amount payable</div>
              <div className="text-3xl font-bold text-primary">{formatINR(total)}</div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {methods.map((m) => {
                const I = icons[m];
                return (
                  <button key={m} onClick={() => { setMethod(m); setConfirmed(false); }} className={`flex flex-col items-center gap-1 rounded-md border py-3 text-xs uppercase ${method === m ? "border-gold bg-primary text-primary-foreground" : "border-border"}`}>
                    <I className="h-5 w-5" />
                    {m}
                  </button>
                );
              })}
            </div>
            {method === "cash" && (
              <div className="space-y-2">
                <input autoFocus inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ""))} placeholder="Cash received (₹)" className="w-full rounded-md border border-input px-3 py-2 text-lg" />
                <div className="flex flex-wrap gap-2">
                  {[total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, 200000].filter((v, i, a) => a.indexOf(v) === i && v >= total).map((v) => (
                    <button key={v} onClick={() => setReceived(String(v / 100))} className="rounded border border-border px-3 py-1 text-sm">{formatINR(v)}</button>
                  ))}
                </div>
                {rec > 0 && (rec >= total ? <p className="text-success">Change due: <b>{formatINR(rec - total)}</b></p> : <p className="text-destructive">Short by {formatINR(total - rec)}</p>)}
              </div>
            )}
            {method === "upi" && (
              <div className="space-y-2 text-sm">
                {settings.upiId ? <p>Ask the customer to pay <b>{formatINR(total)}</b> to UPI ID <b>{settings.upiId}</b>.</p> : <p className="text-warning-foreground">No UPI ID configured yet — add it in Settings.</p>}
                {settings.upiInstructions && <p className="text-muted-foreground">{settings.upiInstructions}</p>}
                <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UPI transaction reference (optional)" className="w-full rounded-md border border-input px-3 py-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> I have seen the payment credited</label>
                <p className="text-xs text-muted-foreground">Unchecked = recorded as pending, to verify later.</p>
              </div>
            )}
            {method === "card" && (
              <div className="space-y-2 text-sm">
                <p>Run {formatINR(total)} on the card terminal. Never enter card numbers here.</p>
                <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Terminal approval code (optional)" className="w-full rounded-md border border-input px-3 py-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Terminal shows APPROVED</label>
              </div>
            )}
            {method === "other" && (
              <div className="space-y-2 text-sm">
                <input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Reference / note" className="w-full rounded-md border border-input px-3 py-2" />
                <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /> Payment confirmed by staff</label>
              </div>
            )}
            <button
              disabled={busy || (method === "cash" && rec < total) || (method === "card" && !confirmed)}
              onClick={submit}
              className="w-full rounded-md bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-40"
            >
              Record payment
            </button>
            <p className="text-center text-xs text-muted-foreground">Payments are staff-confirmed; no gateway is connected.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
