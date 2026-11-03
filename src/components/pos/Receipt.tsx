import { formatINR, lineTotal, unitPriceOf } from "@/lib/pos/billing";
import type { Order, Settings } from "@/lib/pos/types";

export function Receipt({ order, settings }: { order: Order; settings: Settings }) {
  const w = settings.receiptWidth === "58" ? "w-[58mm] text-[10px]" : "w-[80mm] text-[11px]";
  const t = order.totals;
  const pay = order.payments.at(-1);
  return (
    <div id="receipt-print" className={`${w} mx-auto bg-ivory p-3 font-sans text-primary`}>
      <div className="text-center">
        <div className="font-display text-xl font-semibold tracking-[0.15em]">{settings.cafeName.toUpperCase()}</div>
        <div className="font-display italic text-gold">{settings.tagline}</div>
        {settings.address && <div className="mt-1 whitespace-pre-line">{settings.address}</div>}
        {settings.phone && <div>Ph: {settings.phone}</div>}
        {settings.taxRegistration && <div>Tax Reg: {settings.taxRegistration}</div>}
      </div>
      <div className="gold-rule my-2" />
      <div className="grid grid-cols-2 gap-x-2">
        <span>Order: {order.number}</span>
        <span className="text-right">{new Date(order.createdAt).toLocaleString("en-IN")}</span>
        <span className="capitalize">{order.type}{order.tableName ? ` · ${order.tableName}` : ""}</span>
        <span className="text-right">Cashier: {order.cashier}</span>
        {order.customerName && <span className="col-span-2">Customer: {order.customerName} {order.customerPhone}</span>}
      </div>
      <div className="gold-rule my-2" />
      {order.lines.map((l) => (
        <div key={l.key} className="mb-1">
          <div className="flex justify-between gap-2">
            <span className="font-medium">{l.name}{l.variant ? ` (${l.variant.name})` : ""}</span>
            <span>{formatINR(lineTotal(l))}</span>
          </div>
          <div className="opacity-75">
            {l.qty} × {formatINR(unitPriceOf(l))}
            {l.addOns.length > 0 && ` · +${l.addOns.map((a) => a.name).join(", ")}`}
          </div>
        </div>
      ))}
      <div className="gold-rule my-2" />
      <Row k="Subtotal" v={formatINR(t.subtotal)} />
      {t.discount > 0 && <Row k="Discount" v={`− ${formatINR(t.discount)}`} />}
      {t.taxes.filter((x) => x.rateBp > 0).map((x) => (
        <Row key={x.name} k={`${x.name} ${x.rateBp / 100}%${order.taxInclusive ? " (incl.)" : ""}`} v={formatINR(x.tax)} />
      ))}
      <div className="my-1 flex justify-between border-y border-gold py-1 text-sm font-bold">
        <span>TOTAL</span>
        <span>{formatINR(t.total)}</span>
      </div>
      {pay ? (
        <>
          <Row k={`Paid via ${pay.method.toUpperCase()}`} v={pay.status === "verified" ? "Staff-confirmed" : "Pending"} />
          {pay.received != null && <Row k="Cash received" v={formatINR(pay.received)} />}
          {pay.change != null && <Row k="Change" v={formatINR(pay.change)} />}
          {pay.reference && <Row k="Ref" v={pay.reference} />}
        </>
      ) : (
        <Row k="Payment" v="Unpaid" />
      )}
      {order.status === "cancelled" && <div className="mt-1 text-center font-bold">*** CANCELLED ***</div>}
      <div className="gold-rule my-2" />
      <div className="text-center font-display italic">{settings.receiptFooter}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between">
      <span>{k}</span>
      <span>{v}</span>
    </div>
  );
}
