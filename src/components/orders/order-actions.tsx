"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import {
  ORDER_STAGES, displayStageIndex, isStageReached, PAYMENT_MODES, PAYMENT_MODE_LABEL,
} from "@/lib/constants";
import { updateOrderStatus, addPayment, deleteOrder } from "@/app/(app)/orders/actions";
import {
  telLink, waLink, orderConfirmationText, paymentReminderText, deliveryReminderText, type MsgOrder,
} from "@/lib/messages";
import { useAppName } from "@/components/app-name-context";
import { cn, inr } from "@/lib/utils";

export type OrderActionPerms = {
  process: boolean;
  deliverCancel: boolean;
  recordPayment: boolean;
  deleteOrder: boolean;
};

export type OrderTrack = { label: string; track: "cake" | "bake" | null; status: string };

export function OrderActions({
  orderId,
  phone,
  whatsapp,
  balance,
  perms,
  tracks,
  msg,
  showContact = true,
  showStatus = true,
}: {
  orderId: string;
  phone: string;
  whatsapp: string | null;
  balance: number;
  perms: OrderActionPerms;
  // One independently-tracked progress bar per product type (cake / fresh bakes).
  tracks: OrderTrack[];
  msg: MsgOrder;
  showContact?: boolean;
  showStatus?: boolean;
}) {
  const router = useRouter();
  const appName = useAppName();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("CASH");

  const setStatus = (track: "cake" | "bake" | null, s: string) =>
    start(() => void updateOrderStatus(orderId, s, track ?? undefined).then(() => router.refresh()));

  // Mark a track delivered. If a balance is still due, confirm settling it later.
  function markDelivered(track: "cake" | "bake" | null) {
    if (balance > 0 && !confirm(`Balance of ${inr(balance)} is still pending. Mark as delivered and settle the payment later?`)) {
      return;
    }
    setStatus(track, "DELIVERED");
  }

  return (
    <div className="space-y-4">
      {/* Status — one independently-tracked progress bar + controls per product type.
          Gated by the global admin (Settings → Admin access → Order status). */}
      {showStatus && (
      <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold">Order status</p>
        <div className="space-y-4">
          {tracks.map(({ label, track, status }) => {
            const stageIdx = displayStageIndex(status, balance);
            const cancelled = status === "CANCELLED";
            return (
              <div key={label}>
                {label !== "Order" && <p className="mb-1.5 text-xs font-semibold text-foreground/60">{label}</p>}

                {cancelled ? (
                  <div className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">Cancelled</div>
                ) : (
                  <div className="mb-2">
                    <div className="flex gap-1">
                      {ORDER_STAGES.map((s, i) => (
                        <span
                          key={s.key}
                          className={cn("block h-2.5 flex-1 rounded-full transition", isStageReached(i, status, balance) ? (balance <= 0 || i === 4 ? "bg-rose-600" : "bg-brand") : "bg-black/10")}
                        />
                      ))}
                    </div>
                    <div className="mt-1 flex gap-1 text-[9px] leading-tight text-foreground/40">
                      {ORDER_STAGES.map((s, i) => (
                        <span key={s.key} className={cn("flex-1 text-center", i === stageIdx && (balance <= 0 ? "font-semibold text-rose-600" : "font-semibold text-brand"))}>
                          {s.short}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status actions — shown whenever the status section is visible
                    (the Admin-access "Order status" toggle is the single gate). */}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant={stageIdx === 1 ? "primary" : "soft"} disabled={pending} onClick={() => setStatus(track, "BAKING")}>
                    Start processing
                  </Button>
                  <Button size="sm" variant={stageIdx >= 2 ? "primary" : "soft"} disabled={pending} onClick={() => setStatus(track, "OUT_FOR_DELIVERY")}>
                    Finished processing
                  </Button>
                  <Button size="sm" variant={status === "DELIVERED" ? "success" : "soft"} disabled={pending || status === "DELIVERED"} className="ml-auto" onClick={() => markDelivered(track)}>
                    Delivered
                  </Button>
                  <Button size="sm" variant="danger" disabled={pending || cancelled} onClick={() => { if (confirm("Are you sure you want to cancel this order?")) setStatus(track, "CANCELLED"); }}>
                    Cancelled
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Add payment */}
      {perms.recordPayment && balance > 0 && (
        <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
          <p className="mb-2 text-sm font-semibold">Record payment · balance {inr(balance)}</p>
          <div className="flex gap-2">
            <Input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <Select value={mode} onChange={(e) => setMode(e.target.value)} className="w-36">
              {PAYMENT_MODES.map((m) => <option key={m} value={m}>{PAYMENT_MODE_LABEL[m]}</option>)}
            </Select>
            <Button
              disabled={pending || !(Number(amount) > 0)}
              onClick={() =>
                start(() =>
                  void addPayment(orderId, Number(amount), mode).then(() => {
                    setAmount("");
                    router.refresh();
                  })
                )
              }
            >
              Add
            </Button>
          </div>
        </div>
      )}

      {/* Communication — gated by the global admin (Settings → Admin access). */}
      {showContact && (
        <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold">Contact customer</p>
        <div className="flex flex-wrap gap-2">
          <a href={telLink(phone)}><Button size="sm" variant="outline"><Phone size={16} /> Call</Button></a>
          <a href={waLink(whatsapp || phone, orderConfirmationText(msg, appName))} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><MessageCircle size={16} /> Confirmation</Button>
          </a>
          <a href={waLink(whatsapp || phone, paymentReminderText(msg, appName))} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><MessageCircle size={16} /> Payment</Button>
          </a>
          <a href={waLink(whatsapp || phone, deliveryReminderText(msg, appName))} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline"><MessageCircle size={16} /> Delivery</Button>
          </a>
        </div>
      </div>
      )}

      {perms.deleteOrder && (
        <Button
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Delete this order permanently?")) {
              start(() => void deleteOrder(orderId).then(() => router.push("/orders")));
            }
          }}
        >
          <Trash2 size={16} /> Delete order
        </Button>
      )}
    </div>
  );
}
