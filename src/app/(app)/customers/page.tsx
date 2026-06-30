import Link from "next/link";
import { redirect } from "next/navigation";
import { Phone, MessageCircle, Search } from "lucide-react";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getAppName, getAdminSectionAccess } from "@/lib/settings";
import { CUSTOMER_TYPE_LABEL, GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { inr, formatDate, dateKey, cn } from "@/lib/utils";
import { telLink, waLink, paymentReminderText } from "@/lib/messages";

export const dynamic = "force-dynamic";

const TYPE_BADGE: Record<string, string> = {
  NEW: "bg-sky-100 text-sky-700",
  EXISTING: "bg-amber-100 text-amber-700",
  REGULAR: "bg-emerald-100 text-emerald-700",
};

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const user = await requireAdmin();
  // Hidden for this admin by the global admin (Settings → Admin access).
  if (user.email !== GLOBAL_ADMIN_EMAIL && !(await getAdminSectionAccess()).customers) redirect("/orders");
  const sp = await searchParams;
  const tab = sp.tab === "due" ? "due" : "customers";

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <h1 className="mb-3 text-xl font-bold text-brand-dark">Customers</h1>

      {/* Tabs */}
      <div className="mb-4 flex gap-2">
        <TabLink href="/customers" active={tab === "customers"}>Customers</TabLink>
        <TabLink href="/customers?tab=due" active={tab === "due"}>Due payment</TabLink>
      </div>

      {tab === "customers" ? <CustomersTab q={sp.q} /> : <DueTab />}
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-4 py-1.5 text-sm font-medium transition",
        active ? "border-brand bg-brand text-white shadow-sm" : "border-black/10 bg-card text-foreground/70 hover:bg-muted"
      )}
    >
      {children}
    </Link>
  );
}

async function CustomersTab({ q }: { q?: string }) {
  const where: Prisma.CustomerWhereInput = {};
  if (q?.trim()) {
    const needle = q.trim();
    where.OR = [
      { name: { contains: needle, mode: "insensitive" } },
      { phone: { contains: needle } },
      { whatsapp: { contains: needle } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: [{ lastOrderAt: "desc" }, { name: "asc" }],
    take: 300,
    // The customer's most recently placed order — used to deep-link into the
    // orders week view on that order's required date so it actually shows up.
    include: { orders: { orderBy: { orderDate: "desc" }, take: 1, select: { requiredDate: true } } },
  });

  return (
    <>
      <form className="mb-4">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or phone…"
            className="w-full rounded-xl border border-black/10 bg-card py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand"
          />
        </div>
      </form>

      <p className="mb-2 text-sm text-foreground/50">{customers.length} customer(s)</p>

      {customers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-foreground/50">
          No customers found.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {customers.map((c) => {
            // Open the orders week view anchored on the last order's required
            // date (so it's visible) and pre-search this customer's phone.
            const lastOrder = c.orders[0];
            const href = lastOrder
              ? `/orders?d=${dateKey(lastOrder.requiredDate)}&q=${encodeURIComponent(c.phone)}`
              : `/orders?q=${encodeURIComponent(c.phone)}`;
            return (
            <Link
              key={c.id}
              href={href}
              className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm transition hover:border-brand/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-brand-dark">{c.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
                    <span className="inline-flex items-center gap-1"><Phone size={13} /> {c.phone}</span>
                    {c.whatsapp && <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {c.whatsapp}</span>}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[c.customerType] ?? "bg-muted text-foreground/60"}`}>
                  {CUSTOMER_TYPE_LABEL[c.customerType] ?? c.customerType}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-foreground/50">
                <span><span className="font-semibold text-foreground/70">{c.totalOrders}</span> order(s)</span>
                <span><span className="font-semibold text-foreground/70">{inr(c.totalSpent)}</span> spent</span>
                {c.lastOrderAt && <span>Last order {formatDate(c.lastOrderAt)}</span>}
              </div>
            </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

async function DueTab() {
  const [orders, appName] = await Promise.all([
    prisma.order.findMany({
      where: { balanceAmount: { gt: 0 }, orderStatus: { not: "CANCELLED" } },
      orderBy: [{ requiredDate: "asc" }],
      take: 300,
      select: {
        id: true,
        orderNumber: true,
        requiredDate: true,
        requiredTime: true,
        totalAmount: true,
        advancePaid: true,
        balanceAmount: true,
        customer: { select: { name: true, phone: true, whatsapp: true } },
      },
    }),
    getAppName(),
  ]);

  const totalDue = orders.reduce((s, o) => s + o.balanceAmount, 0);

  if (orders.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-foreground/50">
        No pending payments. Everything is settled. 🎉
      </p>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
        <span className="text-sm text-rose-700/80">{orders.length} order(s) with balance due</span>
        <span className="text-lg font-bold text-rose-600">{inr(totalDue)}</span>
      </div>

      <div className="flex flex-col gap-3">
        {orders.map((o) => {
          const reminder = paymentReminderText(
            {
              orderNumber: o.orderNumber,
              customerName: o.customer.name,
              requiredDate: o.requiredDate.toISOString(),
              requiredTime: o.requiredTime,
              totalAmount: o.totalAmount,
              advancePaid: o.advancePaid,
              balanceAmount: o.balanceAmount,
            },
            appName
          );
          return (
            <div key={o.id} className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/orders/${o.id}`} className="truncate font-semibold text-brand-dark hover:underline">
                    {o.customer.name}
                  </Link>
                  <p className="font-mono text-[11px] text-foreground/45">{o.orderNumber} · {formatDate(o.requiredDate)}</p>
                  <p className="mt-0.5 text-sm text-foreground/60">{o.customer.phone}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-base font-bold text-rose-600">{inr(o.balanceAmount)}</p>
                  <p className="text-xs text-foreground/50">due of {inr(o.totalAmount)}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 border-t border-black/5 pt-3">
                <a href={telLink(o.customer.phone)} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-muted">
                  <Phone size={15} /> Call
                </a>
                <a href={waLink(o.customer.whatsapp || o.customer.phone, reminder)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-sm font-medium text-foreground/70 hover:bg-muted">
                  <MessageCircle size={15} /> Remind
                </a>
                <Link href={`/orders/${o.id}`} className="ml-auto inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium text-brand-dark hover:bg-muted">
                  View order →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
