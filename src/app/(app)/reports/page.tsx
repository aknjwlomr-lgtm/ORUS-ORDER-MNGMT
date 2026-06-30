import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, TrendingDown } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getAdminSectionAccess } from "@/lib/settings";
import { inr, dateKey, startOfDay, cn } from "@/lib/utils";
import { PAYMENT_MODE_LABEL, GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { ReportCharts } from "@/components/reports/report-charts";
import { ExportButton } from "@/components/reports/export-button";

export const dynamic = "force-dynamic";

type RangeKey = "30d" | "90d" | "12m" | "all";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12m", label: "12 months" },
  { key: "all", label: "All time" },
];

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** Current window, the equal-length window before it (for deltas), and the trend bucket size. */
function computeWindows(range: RangeKey, now: Date) {
  if (range === "all") {
    return { start: null as Date | null, prevStart: null as Date | null, prevEnd: null as Date | null, bucket: "month" as const };
  }
  if (range === "12m") {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 23, 1);
    return { start, prevStart, prevEnd: start, bucket: "month" as const };
  }
  const days = range === "30d" ? 30 : 90;
  const start = startOfDay(addDays(now, -(days - 1)));
  const prevStart = startOfDay(addDays(now, -(days * 2 - 1)));
  return { start, prevStart, prevEnd: start, bucket: "day" as const };
}

const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0);
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

/** Revenue + order-count series, one point per day or month across the window. */
function buildSeries(
  rows: { createdAt: Date; totalAmount: number }[],
  start: Date,
  now: Date,
  bucket: "day" | "month"
) {
  const points: { key: string; label: string }[] = [];
  if (bucket === "day") {
    const cur = startOfDay(start);
    const end = startOfDay(now);
    while (cur <= end) {
      points.push({ key: dateKey(cur), label: `${cur.getDate()}/${cur.getMonth() + 1}` });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 1);
    while (cur <= end) {
      points.push({ key: monthKey(cur), label: cur.toLocaleString("en-IN", { month: "short", year: "2-digit" }) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  const rev = new Map<string, number>();
  const cnt = new Map<string, number>();
  for (const o of rows) {
    const k = bucket === "day" ? dateKey(o.createdAt) : monthKey(o.createdAt);
    rev.set(k, (rev.get(k) ?? 0) + o.totalAmount);
    cnt.set(k, (cnt.get(k) ?? 0) + 1);
  }
  return points.map((p) => ({ label: p.label, revenue: Math.round(rev.get(p.key) ?? 0), orders: cnt.get(p.key) ?? 0 }));
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireAdmin();
  // Hidden for this admin by the global admin (Settings → Admin access).
  if (user.email !== GLOBAL_ADMIN_EMAIL && !(await getAdminSectionAccess()).reports) redirect("/orders");
  const sp = await searchParams;
  const range: RangeKey = RANGES.find((r) => r.key === sp.range)?.key ?? "30d";

  const now = new Date();
  const win = computeWindows(range, now);

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      select: {
        orderNumber: true, cakeCategory: true, cakeFlavor: true, requiredDate: true,
        orderStatus: true, paymentStatus: true, deliveryType: true,
        totalAmount: true, advancePaid: true, balanceAmount: true, createdAt: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.payment.findMany({ select: { amount: true, paymentMode: true, createdAt: true } }),
  ]);

  const inWin = (d: Date) => (win.start ? d >= win.start : true);
  const inPrev = (d: Date) => (win.prevStart && win.prevEnd ? d >= win.prevStart && d < win.prevEnd : false);

  const rangeOrders = orders.filter((o) => inWin(o.createdAt));
  const rangePayments = payments.filter((p) => inWin(p.createdAt));

  // ── Headline figures ──────────────────────────────────────────────
  const revenue = sum(rangeOrders.map((o) => o.totalAmount));
  const orderCount = rangeOrders.length;
  const aov = orderCount ? revenue / orderCount : 0;
  const collected = sum(rangePayments.map((p) => p.amount));
  const delivered = rangeOrders.filter((o) => o.orderStatus === "DELIVERED").length;
  const homeDelivery = rangeOrders.filter((o) => o.deliveryType === "HOME_DELIVERY").length;
  const pickup = rangeOrders.filter((o) => o.deliveryType === "PICKUP").length;
  // Outstanding is a live snapshot across all open (non-cancelled) orders.
  const outstanding = sum(orders.filter((o) => o.orderStatus !== "CANCELLED").map((o) => Math.max(0, o.balanceAmount)));

  const revenueDelta = pct(revenue, sum(orders.filter((o) => inPrev(o.createdAt)).map((o) => o.totalAmount)));
  const ordersDelta = pct(orderCount, orders.filter((o) => inPrev(o.createdAt)).length);
  const collectedDelta = pct(collected, sum(payments.filter((p) => inPrev(p.createdAt)).map((p) => p.amount)));

  // ── Chart data ────────────────────────────────────────────────────
  const seriesStart =
    win.start ??
    (orders.length ? orders.reduce((min, o) => (o.createdAt < min ? o.createdAt : min), orders[0].createdAt) : now);
  const trend = buildSeries(rangeOrders, seriesStart, now, win.bucket);

  const statusData = [
    { name: "Active", value: rangeOrders.filter((o) => !["DELIVERED", "CANCELLED"].includes(o.orderStatus)).length },
    { name: "Completed", value: delivered },
    { name: "Cancelled", value: rangeOrders.filter((o) => o.orderStatus === "CANCELLED").length },
  ];

  const categoryMap = new Map<string, number>();
  for (const o of rangeOrders) categoryMap.set(o.cakeCategory, (categoryMap.get(o.cakeCategory) ?? 0) + 1);
  const categoryData = [...categoryMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 7);

  const modeMap = new Map<string, number>();
  for (const p of rangePayments) modeMap.set(p.paymentMode, (modeMap.get(p.paymentMode) ?? 0) + p.amount);
  const paymentModeData = [...modeMap.entries()].map(([k, v]) => ({ name: PAYMENT_MODE_LABEL[k] ?? k, value: Math.round(v) }));

  const custMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of rangeOrders) {
    const c = custMap.get(o.customer.name) ?? { revenue: 0, orders: 0 };
    c.revenue += o.totalAmount;
    c.orders += 1;
    custMap.set(o.customer.name, c);
  }
  const topCustomers = [...custMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const exportRows = rangeOrders.map((o) => ({
    order: o.orderNumber,
    customer: o.customer.name,
    required: dateKey(o.requiredDate),
    category: o.cakeCategory,
    flavor: o.cakeFlavor ?? "",
    status: o.orderStatus,
    payment: o.paymentStatus,
    total: o.totalAmount,
    advance: o.advancePaid,
    balance: o.balanceAmount,
  }));

  const label = RANGES.find((r) => r.key === range)!.label;
  const subtitle = range === "all" ? "All-time performance" : `Last ${label.toLowerCase()}`;

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 md:px-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">Reports</h1>
          <p className="text-xs text-foreground/50">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector active={range} />
          <ExportButton rows={exportRows} />
        </div>
      </div>

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={inr(revenue)} delta={revenueDelta} accent />
        <StatCard label="Collected" value={inr(collected)} delta={collectedDelta} />
        <StatCard label="Outstanding" value={inr(outstanding)} hint="Across open orders" danger />
        <StatCard label="Orders" value={orderCount} delta={ordersDelta} />
      </div>

      {/* Secondary stats */}
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Avg order value" value={inr(Math.round(aov))} />
        <MiniStat label="Delivered" value={delivered} />
        <MiniStat label="Home delivery" value={homeDelivery} />
        <MiniStat label="Pickup" value={pickup} />
      </div>

      <ReportCharts trend={trend} status={statusData} category={categoryData} paymentMode={paymentModeData} />

      {/* Top customers */}
      <section className="mt-4 rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold text-brand-dark">Top customers</h3>
        {topCustomers.length === 0 ? (
          <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-foreground/40">
            No orders in this period.
          </p>
        ) : (
          <ol className="divide-y divide-black/5">
            {topCustomers.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-brand-dark">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-foreground/50">{c.orders} order{c.orders === 1 ? "" : "s"}</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold text-brand-dark">{inr(c.revenue)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function PeriodSelector({ active }: { active: RangeKey }) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "30d" ? "/reports" : `/reports?range=${r.key}`}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
            active === r.key ? "bg-card text-brand-dark shadow-sm" : "text-foreground/55 hover:text-foreground/80"
          )}
        >
          {r.label}
        </Link>
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  hint,
  danger,
  accent,
}: {
  label: string;
  value: string | number;
  delta?: number | null;
  hint?: string;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4 shadow-sm", accent ? "border-brand/20 ring-1 ring-brand/5" : "border-black/5")}>
      <p className="text-xs font-medium text-foreground/50">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tracking-tight", danger ? "text-rose-600" : "text-brand-dark")}>{value}</p>
      <div className="mt-1.5 flex h-5 items-center gap-1.5">
        {delta != null ? (
          <>
            <DeltaChip delta={delta} />
            <span className="text-[10px] text-foreground/40">vs prev</span>
          </>
        ) : hint ? (
          <p className="text-[11px] text-foreground/40">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}

function DeltaChip({ delta }: { delta: number }) {
  const up = delta >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      )}
    >
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(delta)}%
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/5 bg-card px-3 py-2.5 shadow-sm">
      <p className="text-lg font-semibold text-brand-dark">{value}</p>
      <p className="text-[11px] text-foreground/50">{label}</p>
    </div>
  );
}
