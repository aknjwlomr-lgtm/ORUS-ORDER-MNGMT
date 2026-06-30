"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Phone, MessageCircle, Pencil, Truck, Clock, CalendarDays, Store, Building2 } from "lucide-react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, inr, bakeQty, formatDate } from "@/lib/utils";
import { ORDER_STAGES, displayStageIndex, isStageReached } from "@/lib/constants";
import { telLink, waLink, orderConfirmationText } from "@/lib/messages";
import { useAppName } from "@/components/app-name-context";
import { updateOrderStatus } from "@/app/(app)/orders/actions";

export type OrderCardData = {
  id: string;
  orderNumber: string;
  customerName: string;
  phone: string;
  whatsapp: string | null;
  orderType: string;
  bakeQuantity: number | null;
  bakeUnit: string | null;
  cakeCategory: string;
  cakeFlavor: string | null;
  cakeWeight: string | null;
  cakeMessage: string | null;
  requiredDate: string;
  requiredTime: string;
  orderStatus: string;
  cakeStatus: string;
  bakeStatus: string;
  paymentStatus: string;
  balanceAmount: number;
  totalAmount: number;
  advancePaid: number;
  deliveryType: string;
  branchId: string | null;
  branchName: string | null;
  cakes: { cakeCategory: string; cakeFlavor: string | null; cakeWeight: string | null; cakeMessage: string | null }[];
  bakeItems: { name: string; quantity: number; unit: string }[];
};

// "17:00" -> "5:00 PM".
function to12h(hhmm: string): string {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":");
  let hr = Number(h);
  const period = hr < 12 ? "AM" : "PM";
  hr = hr % 12 || 12;
  return `${hr}:${(m ?? "00").padStart(2, "0")} ${period}`;
}

export function OrderCard({ o, canEdit = false, canContact = true }: { o: OrderCardData; canEdit?: boolean; canContact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const appName = useAppName();

  const setStatus = (status: string) => start(() => void updateOrderStatus(o.id, status));
  const open = () => router.push(`/orders/${o.id}`);
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  // Show every product line. Newer orders carry cakes[]/bakeItems[]; older ones
  // only have the primary columns, so fall back to those for the order's type.
  const cakeLines = o.cakes.length > 0
    ? o.cakes
    : o.orderType !== "FRESH_BAKES" && o.cakeCategory
      ? [{ cakeCategory: o.cakeCategory, cakeFlavor: o.cakeFlavor, cakeWeight: o.cakeWeight, cakeMessage: o.cakeMessage }]
      : [];
  const bakeLines = o.bakeItems.length > 0
    ? o.bakeItems
    : o.orderType === "FRESH_BAKES" && o.cakeCategory
      ? [{ name: o.cakeCategory, quantity: o.bakeQuantity ?? 0, unit: o.bakeUnit ?? "PIECE" }]
      : [];

  // One progress bar per product type, each tracking its own status (matches the
  // order detail page). A single-type order gets one bar; a MIXED order gets both.
  const products: { label: string; status: string }[] = [];
  if (cakeLines.length > 0) products.push({ label: "🎂 Cake", status: o.cakeStatus });
  if (bakeLines.length > 0) products.push({ label: "🥐 Fresh Bakes", status: o.bakeStatus });
  if (products.length === 0) products.push({ label: "Order", status: o.orderStatus });

  const waText = orderConfirmationText({
    orderNumber: o.orderNumber,
    customerName: o.customerName,
    requiredDate: o.requiredDate,
    requiredTime: o.requiredTime,
    totalAmount: o.totalAmount,
    advancePaid: o.advancePaid,
    balanceAmount: o.balanceAmount,
  }, appName);

  return (
    <div
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } }}
      className="group cursor-pointer rounded-2xl border border-black/5 bg-card p-4 shadow-sm outline-none transition hover:border-brand/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      {/* Header: customer + status, with admin Edit at top-right */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-wide text-foreground/45">{o.orderNumber}</p>
          <p className="truncate font-semibold">{o.customerName}</p>
          <p className="text-sm text-foreground/55">{o.phone}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {canEdit && (
              <Link
                href={`/orders/${o.id}/edit`}
                onClick={stop}
                aria-label="Edit order"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-foreground/50 transition hover:bg-muted hover:text-brand"
              >
                <Pencil size={15} />
              </Link>
            )}
            <OrderStatusBadge status={o.orderStatus} />
          </div>
          <PaymentStatusBadge status={o.paymentStatus} />
        </div>
      </div>

      {/* Products — every cake and fresh-bake line (a MIXED order has both). */}
      <div className="mt-3 space-y-0.5 text-sm font-medium text-foreground/85">
        {cakeLines.map((c, i) => (
          <div key={`c${i}`}>
            <p>🎂 {c.cakeCategory}{c.cakeFlavor ? ` · ${c.cakeFlavor}` : ""}{c.cakeWeight ? ` · ${c.cakeWeight}` : ""}</p>
            {c.cakeMessage?.trim() && (
              <p className="pl-5 text-xs font-normal italic text-foreground/55">“{c.cakeMessage.trim()}”</p>
            )}
          </div>
        ))}
        {bakeLines.map((b, i) => (
          <p key={`b${i}`}>🥐 {b.name}{b.quantity ? ` · ${bakeQty(b.quantity, b.unit)}` : ""}</p>
        ))}
      </div>

      {/* Meta: weekday + date · 12h time · delivery · branch */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/55">
        <span className="inline-flex items-center gap-1">
          <CalendarDays size={13} /> {formatDate(o.requiredDate, { weekday: "short", day: "2-digit", month: "short" })}
        </span>
        {o.requiredTime && (
          <span className="inline-flex items-center gap-1"><Clock size={13} /> {to12h(o.requiredTime)}</span>
        )}
        <span className="inline-flex items-center gap-1">
          {o.deliveryType === "PICKUP" ? <><Store size={13} /> Pickup</> : <><Truck size={13} /> Delivery</>}
        </span>
        {o.branchName && (
          <span className="inline-flex items-center gap-1"><Building2 size={13} /> {o.branchName}</span>
        )}
      </div>

      {o.balanceAmount > 0 && (
        <p className="mt-2 text-sm font-medium text-rose-600">Balance due: {inr(o.balanceAmount)}</p>
      )}

      {/* Progress — one bar per product type the order has (cakes / fresh bakes).
          A single-type order shows just one bar. */}
      <div className="mt-3 border-t border-black/5 pt-3" onClick={stop}>
        <StageBar status={o.orderStatus} balance={o.balanceAmount} pending={pending} onSelect={setStatus} products={products} />
      </div>

      {/* Contact — gated by the global admin (Settings → Admin access). */}
      {canContact && (
        <div className="mt-3 flex gap-2" onClick={stop}>
          <a href={telLink(o.phone)} className="flex-1">
            <Button size="sm" variant="ghost" className="w-full"><Phone size={16} /> Call</Button>
          </a>
          <a href={waLink(o.whatsapp || o.phone, waText)} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" variant="ghost" className="w-full"><MessageCircle size={16} /> WhatsApp</Button>
          </a>
        </div>
      )}
    </div>
  );
}

// Order progress: 5 linear stages shown as a segmented bar, with the current
// stage named above. The bar is display-only — it advances automatically as the
// order moves through the process; it can't be set by tapping it. An order with
// both cakes and fresh bakes shows one bar per product type. Cancelled is a
// separate state with a Reopen action.
function StageBar({
  status,
  balance,
  pending,
  onSelect,
  products,
}: {
  status: string;
  balance: number;
  pending: boolean;
  onSelect: (s: string) => void;
  products: { label: string; status: string }[];
}) {
  // The whole order is cancelled only when every track is — then offer Reopen.
  if (status === "CANCELLED") {
    return (
      <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2">
        <span className="text-sm font-semibold text-rose-600">Order cancelled</span>
        <button type="button" disabled={pending} onClick={() => onSelect("CONFIRMED")} className="text-xs font-medium text-rose-600 transition hover:underline">
          Reopen
        </button>
      </div>
    );
  }
  const paid = balance <= 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-end">
        <button type="button" disabled={pending} onClick={() => onSelect("CANCELLED")} className="shrink-0 text-xs text-foreground/40 transition hover:text-rose-600">
          Cancel order
        </button>
      </div>
      <div className="space-y-2.5">
        {products.map(({ label, status: pStatus }) => {
          // Each track advances on its own status; Payment is gated by the balance.
          const idx = displayStageIndex(pStatus, balance);
          const cancelled = pStatus === "CANCELLED";
          return (
            <div key={label}>
              {label !== "Order" && (
                <p className="mb-1 text-xs font-medium text-foreground/55">{label}</p>
              )}
              {cancelled ? (
                <div className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600">Cancelled</div>
              ) : (
                <>
                  <div className="flex gap-1">
                    {ORDER_STAGES.map((s, i) => (
                      <span key={s.key} aria-label={s.label} title={s.label} className="flex-1 py-1.5">
                        <span className={cn("block h-2.5 rounded-full transition", isStageReached(i, pStatus, balance) ? (paid || i === 4 ? "bg-rose-600" : "bg-brand") : "bg-black/10")} />
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex gap-1 text-[9px] leading-tight text-foreground/40">
                    {ORDER_STAGES.map((s, i) => (
                      <span key={s.key} className={cn("flex-1 text-center", i === idx && (paid ? "font-semibold text-rose-600" : "font-semibold text-brand"))}>{s.short}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
