import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Printer } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { getAdminSectionAccess } from "@/lib/settings";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OrderActions } from "@/components/orders/order-actions";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { inr, formatDate, bakeQty, dateKey } from "@/lib/utils";
import { DELIVERY_TYPE_LABEL, PRIORITY_LABEL, PAYMENT_MODE_LABEL, GLOBAL_ADMIN_EMAIL } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      cakes: { orderBy: { position: "asc" } },
      bakeItems: { orderBy: { position: "asc" } },
      payments: { orderBy: { createdAt: "desc" }, include: { receivedBy: { select: { name: true } } } },
      timeline: { orderBy: { createdAt: "desc" }, include: { performedBy: { select: { name: true } } } },
      reminders: { orderBy: { reminderDate: "asc" } },
    },
  });
  if (!o) notFound();

  // What the current user is allowed to do on this order. The global admin always
  // has full access; everyone else follows their per-user permission flags.
  const isGlobalAdmin = user?.email === GLOBAL_ADMIN_EMAIL;
  const me = user && !isGlobalAdmin
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { permProcess: true, permDeliverCancel: true, permRecordPayment: true, permDeleteOrder: true },
      })
    : null;
  const perms = {
    process: isGlobalAdmin ? true : me?.permProcess ?? false,
    deliverCancel: isGlobalAdmin ? true : me?.permDeliverCancel ?? false,
    recordPayment: isGlobalAdmin ? true : me?.permRecordPayment ?? false,
    deleteOrder: isGlobalAdmin ? true : me?.permDeleteOrder ?? false,
  };

  // Customer-contact block and Receipt: global admin always; others only when the
  // global admin enabled them (Settings → Admin access).
  const access = isGlobalAdmin ? null : await getAdminSectionAccess();
  const showContact = isGlobalAdmin || !!access?.contact;
  const showReceipt = isGlobalAdmin || !!access?.receipt;
  const showStatus = isGlobalAdmin || !!access?.orderStatus;

  // An order may have cakes, fresh-bake items, or both. Older orders have no
  // line rows, so fall back to the primary columns for their single type.
  const hasCakes = o.cakes.length > 0 || o.orderType === "CAKE";
  const hasItems = o.bakeItems.length > 0 || o.orderType === "FRESH_BAKES";
  const cakeList = o.cakes.length > 0 ? o.cakes : [o];
  const bakeItemList =
    o.bakeItems.length > 0
      ? o.bakeItems
      : [{ name: o.cakeCategory, quantity: o.bakeQuantity ?? 1, unit: o.bakeUnit, price: o.cakePrice, notes: o.specialInstructions }];

  // One independently-tracked progress bar per product type (both for MIXED).
  const tracks: { label: string; track: "cake" | "bake" | null; status: string }[] = [];
  if (hasCakes) tracks.push({ label: "🎂 Cake", track: "cake", status: o.cakeStatus });
  if (hasItems) tracks.push({ label: "🥐 Fresh Bakes", track: "bake", status: o.bakeStatus });
  if (tracks.length === 0) tracks.push({ label: "Order", track: null, status: o.orderStatus });

  const msg = {
    orderNumber: o.orderNumber,
    customerName: o.customer.name,
    requiredDate: o.requiredDate.toISOString(),
    requiredTime: o.requiredTime,
    totalAmount: o.totalAmount,
    advancePaid: o.advancePaid,
    balanceAmount: o.balanceAmount,
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <Link
        href={`/orders?d=${dateKey(o.requiredDate)}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-foreground/60 hover:text-brand-dark"
      >
        <ArrowLeft size={16} /> Back to orders
      </Link>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-mono text-sm text-foreground/50">{o.orderNumber}</p>
          <h1 className="text-xl font-bold">{o.customer.name}</h1>
          <div className="mt-1 flex gap-2">
            <OrderStatusBadge status={o.orderStatus} />
            <PaymentStatusBadge status={o.paymentStatus} />
          </div>
        </div>
        <div className="flex gap-2">
          {showReceipt && (
            <Link href={`/orders/${o.id}/receipt`}><Button size="sm" variant="outline"><Printer size={16} /> Receipt</Button></Link>
          )}
          {user?.role === "ADMIN" && (
            <Link href={`/orders/${o.id}/edit`}><Button size="sm"><Pencil size={16} /> Edit</Button></Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Customer">
          <Field k="Phone" v={o.customer.phone} />
          <Field k="WhatsApp" v={o.customer.whatsapp ?? "—"} />
          <Field k="Email" v={o.customer.email ?? "—"} />
          <Field k="Address" v={o.customer.address ?? "—"} />
          <Field k="Type" v={o.customer.customerType} />
          <Field k="Total orders" v={String(o.customer.totalOrders)} />
          {o.assignedStaff && <Field k="Staff" v={o.assignedStaff} />}
        </Section>

        {hasCakes &&
          cakeList.map((c, i) => (
            <Section key={`c${i}`} title={cakeList.length > 1 ? `Cake ${i + 1}` : "Cake"}>
              <Field k="Category" v={c.cakeCategory} />
              <Field k="Flavor" v={c.cakeFlavor ?? "—"} />
              <Field k="Shape / Weight" v={`${c.cakeShape ?? "—"} · ${c.cakeWeight ?? "—"}`} />
              <Field k="Tiers" v={`${c.tiers} · ${c.eggOption === "EGG" ? "With egg" : "Eggless"}${c.sugarFree ? " · Sugar-free" : ""}`} />
              <Field k="Theme / Color" v={`${c.theme ?? "—"} · ${c.colorPreference ?? "—"}`} />
              <Field k="Message" v={c.cakeMessage ?? "—"} />
              {(cakeList.length > 1 || hasItems) && <Field k="Price" v={inr("price" in c ? c.price : o.cakePrice)} />}
              {c.designDescription && <Field k="Design" v={c.designDescription} />}
              {c.specialInstructions && <Field k="Instructions" v={c.specialInstructions} />}
            </Section>
          ))}

        {hasItems && (
          <Section title="Fresh Bakes">
            {bakeItemList.map((it, i) => (
              <Field
                key={i}
                k={bakeItemList.length > 1 ? `Item ${i + 1}` : "Item"}
                v={`${it.name} · ${bakeQty(it.quantity, it.unit)}${bakeItemList.length > 1 || hasCakes ? " · " + inr(it.price) : ""}${it.notes?.trim() ? ` · ${it.notes.trim()}` : ""}`}
              />
            ))}
          </Section>
        )}

        <Section title="Delivery">
          <Field k="Type" v={DELIVERY_TYPE_LABEL[o.deliveryType]} />
          <Field k="Required" v={`${formatDate(o.requiredDate)} at ${o.requiredTime}`} />
          <Field k="Occasion" v={o.occasion ?? "—"} />
          <Field k="Priority" v={PRIORITY_LABEL[o.priority]} />
          {o.deliveryAddress && <Field k="Address" v={o.deliveryAddress} />}
          {o.deliveryPerson && <Field k="Delivery person" v={o.deliveryPerson} />}
        </Section>

        <Section title="Payment">
          <Field k={hasCakes && hasItems ? "Order subtotal" : hasItems ? (bakeItemList.length > 1 ? "Items total" : "Item price") : cakeList.length > 1 ? "Cakes total" : "Cake price"} v={inr(o.cakePrice)} />
          <Field k="Extra / Delivery" v={`${inr(o.extraCharge)} · ${inr(o.deliveryCharge)}`} />
          <Field k="Discount / Tax" v={`${inr(o.discount)} · ${inr(o.tax)}`} />
          <Field k="Total" v={inr(o.totalAmount)} bold />
          <Field k="Advance paid" v={inr(o.advancePaid)} />
          <Field k="Balance" v={inr(o.balanceAmount)} bold danger />
          {o.paymentMode && <Field k="Mode" v={PAYMENT_MODE_LABEL[o.paymentMode]} />}
          {o.payments.length > 0 && (
            <div className="mt-2 border-t border-black/5 pt-2 text-xs text-foreground/60">
              {o.payments.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span>{formatDate(p.createdAt)} · {PAYMENT_MODE_LABEL[p.paymentMode]}</span>
                  <span>{inr(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

      </div>

      {o.reminders.length > 0 && (
        <Section title="Reminders" className="mt-4">
          {o.reminders.map((r) => (
            <Field key={r.id} k={`${formatDate(r.reminderDate)} ${r.reminderTime}`} v={`${r.title} · ${r.status}`} />
          ))}
        </Section>
      )}

      <div className="mt-4">
        <OrderActions
          orderId={o.id}
          phone={o.customer.phone}
          whatsapp={o.customer.whatsapp}
          balance={o.balanceAmount}
          perms={perms}
          tracks={tracks}
          msg={msg}
          showContact={showContact}
          showStatus={showStatus}
        />
      </div>

      {o.timeline.length > 0 && (
        <CollapsibleSection title="Order timeline" className="mt-4">
          <ol className="relative space-y-3 pl-4">
            {o.timeline.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-4 top-1.5 h-2 w-2 rounded-full bg-brand" />
                <p className="text-sm font-medium">{t.action}</p>
                <p className="text-xs text-foreground/50">
                  {formatDate(t.createdAt, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  {t.performedBy ? ` · ${t.performedBy.name}` : ""}
                  {t.newStatus ? ` · → ${t.newStatus}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </CollapsibleSection>
      )}
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-black/5 bg-card p-4 shadow-sm ${className ?? ""}`}>
      <h2 className="mb-2 font-semibold text-brand-dark">{title}</h2>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Field({ k, v, bold, danger }: { k: string; v: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-foreground/50">{k}</span>
      <span className={`text-right ${bold ? "font-bold" : ""} ${danger ? "text-rose-600" : ""}`}>{v}</span>
    </div>
  );
}
