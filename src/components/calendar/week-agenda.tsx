"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, Search, Bell, SlidersHorizontal, CalendarDays } from "lucide-react";
import { OrderCard, type OrderCardData } from "@/components/orders/order-card";
import { getOrderCountsByDay } from "@/app/(app)/orders/actions";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn, dateKey, inr } from "@/lib/utils";
import {
  ORDER_STAGES,
  orderStageIndex,
  ORDER_STATUS_DOT,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  DELIVERY_TYPES,
  DELIVERY_TYPE_LABEL,
  CAKE_CATEGORIES,
  FRESH_BAKE_ITEMS,
} from "@/lib/constants";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Local Date from a "YYYY-MM-DD" key (no timezone shift).
function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
// Shift a "YYYY-MM-DD" key by n days.
function shiftKey(key: string, days: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

// Shift a "YYYY-MM" month key by n months.
function monthShiftKey(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Popover month grid: tap a day to jump to that week (a Link reload). The viewed
// month is local state so you can browse months without leaving the page.
function MiniCalendar({ selected, onPick }: { selected: string; onPick: () => void }) {
  const [ym, setYm] = useState(() => selected.slice(0, 7));
  const [y, m] = ym.split("-").map(Number);
  const todayKey = dateKey(new Date());

  const cells = useMemo(() => {
    const startOffset = new Date(y, m - 1, 1).getDay();
    const gridStart = new Date(y, m - 1, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [y, m]);

  // Order counts per day for the visible grid (fetched as you browse months).
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    let active = true;
    getOrderCountsByDay(dateKey(cells[0]), dateKey(cells[cells.length - 1]))
      .then((c) => { if (active) setCounts(c); })
      .catch(() => { if (active) setCounts({}); });
    return () => { active = false; };
  }, [cells]);

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <>
      {/* Dimmed backdrop — tap to dismiss. */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onPick} aria-hidden />
      {/* Centered on screen (works on mobile and desktop). */}
      <div className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-card p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setYm(monthShiftKey(ym, -1))} className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground/60 hover:bg-muted" aria-label="Previous month">
          <ChevronLeft size={20} />
        </button>
        <span className="text-base font-semibold text-brand-dark">{monthLabel}</span>
        <button type="button" onClick={() => setYm(monthShiftKey(ym, 1))} className="flex h-10 w-10 items-center justify-center rounded-xl text-foreground/60 hover:bg-muted" aria-label="Next month">
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-foreground/40">
        {WEEKDAYS.map((w) => <div key={w} className="py-1.5">{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const k = dateKey(d);
          const inMonth = d.getMonth() === m - 1;
          const isSel = k === selected;
          const isToday = k === todayKey;
          const count = counts[k] ?? 0;
          return (
            <Link
              key={k}
              href={`/orders?d=${k}`}
              onClick={onPick}
              title={count > 0 ? `${count} order${count === 1 ? "" : "s"}` : undefined}
              className={cn(
                "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl text-[15px] transition",
                !inMonth && "opacity-30",
                isSel ? "bg-brand font-semibold text-white" : "hover:bg-muted",
                isToday && !isSel && "font-semibold text-brand ring-1 ring-brand/40"
              )}
            >
              <span className="leading-none">{d.getDate()}</span>
              {count > 0 ? (
                <span
                  className={cn(
                    "min-w-[15px] rounded-full px-1 text-center text-[9px] font-bold leading-[15px]",
                    isSel ? "bg-white/25 text-white" : "bg-brand/10 text-brand-dark"
                  )}
                >
                  {count}
                </span>
              ) : (
                <span className="h-[15px]" aria-hidden />
              )}
            </Link>
          );
        })}
      </div>
      </div>
    </>
  );
}

export function WeekAgenda({
  weekStartKey,
  orders,
  selectedDate,
  dueReminders,
  canEdit = false,
  branches = [],
  cakeCategories = CAKE_CATEGORIES,
  freshBakeItems = FRESH_BAKE_ITEMS,
  initialQuery = "",
}: {
  weekStartKey: string;
  orders: OrderCardData[];
  selectedDate: string;
  dueReminders: number;
  canEdit?: boolean;
  branches?: { id: string; name: string }[];
  cakeCategories?: string[];
  freshBakeItems?: string[];
  initialQuery?: string;
}) {
  const [selected, setSelected] = useState(selectedDate);
  // After navigating to another week the server sends a new anchor day. Re-sync the
  // highlighted day during render (React's "adjust state on prop change" pattern) so
  // the agenda and the prev/next links follow the new week instead of freezing.
  const [anchorSeen, setAnchorSeen] = useState(selectedDate);
  if (anchorSeen !== selectedDate) {
    setAnchorSeen(selectedDate);
    setSelected(selectedDate);
  }
  const [q, setQ] = useState(initialQuery);
  const [showFilters, setShowFilters] = useState(false);
  // Tapping the week range opens a month calendar to jump to any date.
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    }
    if (pickerOpen) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [pickerOpen]);
  const [statusFilter, setStatusFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [bakeFilter, setBakeFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const router = useRouter();
  const todayKey = dateKey(new Date());

  // Jump to today: load today's week (if not already) and focus today's date.
  function goToday() {
    setSelected(todayKey);
    router.push(`/orders?d=${todayKey}`);
  }

  const activeFilters =
    (statusFilter ? 1 : 0) + (deliveryFilter ? 1 : 0) + (paymentFilter ? 1 : 0) +
    (categoryFilter ? 1 : 0) + (bakeFilter ? 1 : 0) + (branchFilter ? 1 : 0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return orders.filter((o) => {
      // Status filter uses the progress-bar stages: a stage matches any order
      // whose stored status folds into it (e.g. "Processing" = baking/decoration/
      // packed/ready). Cancelled is its own state, matched exactly.
      if (statusFilter) {
        if (statusFilter === "CANCELLED") {
          if (o.orderStatus !== "CANCELLED") return false;
        } else if (o.orderStatus === "CANCELLED" || orderStageIndex(o.orderStatus) !== orderStageIndex(statusFilter)) {
          return false;
        }
      }
      if (deliveryFilter && o.deliveryType !== deliveryFilter) return false;
      if (paymentFilter && o.paymentStatus !== paymentFilter) return false;
      if (categoryFilter && o.cakeCategory !== categoryFilter) return false;
      // Fresh-bakes filter: match any of the order's bakery-item lines (newer
      // orders carry bakeItems[]; older FRESH_BAKES orders keep the name in
      // cakeCategory), mirroring how the card derives its bake lines.
      if (bakeFilter) {
        const bakeNames = o.bakeItems.length > 0
          ? o.bakeItems.map((b) => b.name)
          : o.orderType === "FRESH_BAKES" && o.cakeCategory ? [o.cakeCategory] : [];
        if (!bakeNames.includes(bakeFilter)) return false;
      }
      if (branchFilter && o.branchId !== branchFilter) return false;
      if (needle) {
        const hay = `${o.orderNumber} ${o.customerName} ${o.phone} ${o.cakeFlavor ?? ""} ${o.cakeCategory}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [orders, q, statusFilter, deliveryFilter, paymentFilter, categoryFilter, bakeFilter, branchFilter]);

  const byDay = useMemo(() => {
    const map = new Map<string, OrderCardData[]>();
    for (const o of filtered) {
      const k = dateKey(o.requiredDate);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(o);
    }
    return map;
  }, [filtered]);

  // The 7 days of the visible week.
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => shiftKey(weekStartKey, i)),
    [weekStartKey]
  );

  const dayOrders = useMemo(() => byDay.get(selected) ?? [], [byDay, selected]);
  const summary = useMemo(() => {
    const s = { total: dayOrders.length, pending: 0, ready: 0, delivered: 0, expected: 0, balance: 0 };
    for (const o of dayOrders) {
      if (["NEW", "CONFIRMED", "INGREDIENTS_READY", "BAKING", "DECORATION", "PACKED"].includes(o.orderStatus)) s.pending++;
      if (o.orderStatus === "READY") s.ready++;
      if (o.orderStatus === "DELIVERED") s.delivered++;
      s.expected += o.totalAmount;
      s.balance += o.balanceAmount;
    }
    return s;
  }, [dayOrders]);

  // Week range label, e.g. "6 – 12 Oct 2025" (or spanning two months).
  const startD = fromKey(weekStartKey);
  const endD = fromKey(shiftKey(weekStartKey, 6));
  const sameMonth = startD.getMonth() === endD.getMonth();
  const rangeLabel = sameMonth
    ? `${startD.getDate()} – ${endD.getDate()} ${endD.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`
    : `${startD.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${endD.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;

  const selectedLabel = fromKey(selected).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Prev/next week keep the same weekday; "Today" jumps to the current week.
  const prevHref = `/orders?d=${shiftKey(selected, -7)}`;
  const nextHref = `/orders?d=${shiftKey(selected, 7)}`;

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-brand-dark">Orders</h1>
        {selected !== todayKey && (
          <Button size="sm" variant="outline" onClick={goToday}><CalendarDays size={15} /> Today</Button>
        )}
      </div>

      {dueReminders > 0 && (
        <Link
          href="/reminders"
          className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
        >
          <Bell size={16} /> You have {dueReminders} reminder{dueReminders > 1 ? "s" : ""} due today.
        </Link>
      )}

      {/* Search + filter toggle */}
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
          <Input
            placeholder="Search this week…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFilters || activeFilters > 0 ? "primary" : "outline"}
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal size={16} />
          {activeFilters > 0 && <span className="ml-1 text-xs">{activeFilters}</span>}
        </Button>
      </div>

      {showFilters && (
        <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-black/5 bg-card p-3 shadow-sm sm:grid-cols-3">
          {branches.length > 0 && (
            <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
              <option value="">All branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          )}
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            {ORDER_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            <option value="CANCELLED">Cancelled</option>
          </Select>
          <Select value={deliveryFilter} onChange={(e) => setDeliveryFilter(e.target.value)}>
            <option value="">All types</option>
            {DELIVERY_TYPES.map((s) => <option key={s} value={s}>{DELIVERY_TYPE_LABEL[s]}</option>)}
          </Select>
          <Select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="">All payments</option>
            {PAYMENT_STATUSES.filter((s) => s !== "REFUNDED").map((s) => <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>)}
          </Select>
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All cakes</option>
            {cakeCategories.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
          <Select value={bakeFilter} onChange={(e) => setBakeFilter(e.target.value)}>
            <option value="">All bakes</option>
            {freshBakeItems.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </div>
      )}

      {/* Week strip */}
      <div className="rounded-2xl border border-black/5 bg-card p-2 shadow-sm sm:p-3">
        <div className="mb-1 flex items-center justify-between px-1">
          <Link href={prevHref} aria-label="Previous week">
            <Button size="icon" variant="ghost"><ChevronLeft size={18} /></Button>
          </Link>
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-brand-dark hover:bg-muted"
            >
              <CalendarDays size={15} className="text-foreground/40" />
              {rangeLabel}
            </button>
            {pickerOpen && (
              <MiniCalendar selected={selected} onPick={() => setPickerOpen(false)} />
            )}
          </div>
          <Link href={nextHref} aria-label="Next week">
            <Button size="icon" variant="ghost"><ChevronRight size={18} /></Button>
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {week.map((k) => {
            const d = fromKey(k);
            const list = byDay.get(k) ?? [];
            const isToday = k === todayKey;
            const isSelected = k === selected;
            return (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-xl py-2 transition",
                  isSelected ? "bg-brand text-white shadow-sm" : "hover:bg-muted",
                  isToday && !isSelected && "ring-2 ring-brand/40"
                )}
              >
                <span className={cn("text-[10px] font-medium uppercase", isSelected ? "text-white/80" : "text-foreground/45")}>
                  {WEEKDAYS[d.getDay()]}
                </span>
                <span className={cn("text-base font-semibold leading-none", isToday && !isSelected && "text-brand")}>
                  {d.getDate()}
                </span>
                <span className="flex h-4 items-center gap-0.5">
                  {list.length > 0 ? (
                    isSelected ? (
                      <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-bold leading-tight text-white">
                        {list.length}
                      </span>
                    ) : (
                      list.slice(0, 3).map((o, i) => (
                        <span key={i} className={cn("h-1.5 w-1.5 rounded-full", ORDER_STATUS_DOT[o.orderStatus])} />
                      ))
                    )
                  ) : (
                    <span className="h-1.5 w-1.5" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day header + summary */}
      <div className="mt-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-bold">{selectedLabel}</h2>
          <p className="text-xs text-foreground/50">
            {summary.total} order{summary.total === 1 ? "" : "s"}
            {summary.total > 0 && ` · ${inr(summary.expected)} expected`}
          </p>
        </div>
        <Link href={`/orders/new?date=${selected}`}>
          <Button size="sm"><Plus size={16} /> New</Button>
        </Link>
      </div>

      {summary.total > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Pill label="Pending" value={summary.pending} />
          <Pill label="Ready" value={summary.ready} />
          <Pill label="Delivered" value={summary.delivered} />
          {summary.balance > 0 && <Pill label="Balance" value={inr(summary.balance)} danger />}
        </div>
      )}

      {/* Agenda */}
      <div className="mt-3 flex flex-col gap-3">
        {dayOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 bg-card/50 p-8 text-center text-sm text-foreground/50">
            No orders for this day.
            <div className="mt-3">
              <Link href={`/orders/new?date=${selected}`}>
                <Button size="sm" variant="outline"><Plus size={16} /> Add an order</Button>
              </Link>
            </div>
          </div>
        ) : (
          dayOrders.map((o) => <OrderCard key={o.id} o={o} canEdit={canEdit} />)
        )}
      </div>

      {/* Floating new order button (mobile) */}
      <Link href={`/orders/new?date=${selected}`} className="md:hidden">
        <button className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg active:scale-95">
          <Plus size={26} />
        </button>
      </Link>
    </div>
  );
}

function Pill({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-full bg-muted/70 px-3 py-1 text-sm">
      <span className={cn("font-bold", danger && "text-rose-600")}>{value}</span>
      <span className="text-xs text-foreground/50">{label}</span>
    </div>
  );
}
