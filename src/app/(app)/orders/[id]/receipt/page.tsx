import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getAppName } from "@/lib/settings";
import { inr, formatDate, bakeQty } from "@/lib/utils";
import { PAYMENT_MODE_LABEL, ORDER_STATUS_LABEL } from "@/lib/constants";
import { ReceiptActions } from "./receipt-actions";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      cakes: { orderBy: { position: "asc" } },
      bakeItems: { orderBy: { position: "asc" } },
    },
  });
  if (!o) notFound();
  const appName = await getAppName();

  // An order may have cakes, fresh-bake items, or both. Older orders have no
  // line rows, so fall back to the primary columns for their single type.
  const hasCakes = o.cakes.length > 0 || o.orderType === "CAKE";
  const hasItems = o.bakeItems.length > 0 || o.orderType === "FRESH_BAKES";
  const isBake = hasItems && !hasCakes;
  const cakeList = o.cakes.length > 0 ? o.cakes : [o];
  const bakeItemList =
    o.bakeItems.length > 0
      ? o.bakeItems
      : [{ name: o.cakeCategory, quantity: o.bakeQuantity ?? 1, unit: o.bakeUnit, price: o.cakePrice, notes: o.specialInstructions }];

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <ReceiptActions />
      <div className="mt-4 rounded-2xl border border-black/10 bg-white p-6 text-sm shadow-sm">
        <div className="text-center">
          <div className="text-3xl">{isBake ? "🥐" : "🎂"}</div>
          <h1 className="text-lg font-bold text-brand-dark">{appName}</h1>
          <p className="text-xs text-foreground/50">{hasCakes && !hasItems ? "Cake Order Receipt" : "Order Receipt"}</p>
        </div>
        <div className="my-4 border-t border-dashed border-black/15" />
        <Line k="Order #" v={o.orderNumber} />
        <Line k="Date" v={formatDate(o.createdAt)} />
        <Line k="Customer" v={o.customer.name} />
        <Line k="Phone" v={o.customer.phone} />
        <div className="my-3 border-t border-dashed border-black/15" />
        {hasCakes &&
          cakeList.map((c, i) => (
            <div key={`c${i}`}>
              <Line
                k={cakeList.length > 1 ? `Cake ${i + 1}` : "Cake"}
                v={`${c.cakeCategory}${c.cakeFlavor ? " · " + c.cakeFlavor : ""}`}
              />
              <Line k="Weight" v={c.cakeWeight ?? "—"} />
              {c.cakeMessage && <Line k="Message" v={c.cakeMessage} />}
              {(cakeList.length > 1 || hasItems) && <Line k="Price" v={inr("price" in c ? c.price : o.cakePrice)} />}
            </div>
          ))}
        {hasItems &&
          bakeItemList.map((it, i) => (
            <div key={`i${i}`}>
              <Line
                k={bakeItemList.length > 1 ? `Item ${i + 1}` : "Item"}
                v={`${it.name} · ${bakeQty(it.quantity, it.unit)}`}
              />
              {(bakeItemList.length > 1 || hasCakes) && <Line k="Price" v={inr(it.price)} />}
              {it.notes?.trim() && <Line k="Notes" v={it.notes.trim()} />}
            </div>
          ))}
        <Line k="Required" v={`${formatDate(o.requiredDate)} at ${o.requiredTime}`} />
        <div className="my-3 border-t border-dashed border-black/15" />
        <Line k={isBake ? (bakeItemList.length > 1 ? "Items total" : "Item price") : cakeList.length > 1 ? "Cakes total" : "Cake price"} v={inr(o.cakePrice)} />
        {o.extraCharge > 0 && <Line k="Extra charge" v={inr(o.extraCharge)} />}
        {o.deliveryCharge > 0 && <Line k="Delivery" v={inr(o.deliveryCharge)} />}
        {o.discount > 0 && <Line k="Discount" v={`- ${inr(o.discount)}`} />}
        <Line k="Total" v={inr(o.totalAmount)} bold />
        <Line k="Advance paid" v={inr(o.advancePaid)} />
        <Line k="Balance" v={inr(o.balanceAmount)} bold />
        {o.paymentMode && <Line k="Payment mode" v={PAYMENT_MODE_LABEL[o.paymentMode]} />}
        <Line k="Status" v={ORDER_STATUS_LABEL[o.orderStatus]} />
        <div className="my-4 border-t border-dashed border-black/15" />
        <p className="text-center text-xs text-foreground/60">
          Thank you for ordering from {appName}! 💝
        </p>
      </div>
    </div>
  );
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-foreground/60">{k}</span>
      <span className={bold ? "font-bold" : ""}>{v}</span>
    </div>
  );
}
