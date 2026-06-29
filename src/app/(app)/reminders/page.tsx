import Link from "next/link";
import { Plus, Archive } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getBranchManagementEnabled } from "@/lib/settings";
import { Button } from "@/components/ui/button";
import { OrderBoard, type BoardSection } from "@/components/reminders/order-board";
import { ReminderItem, type ReminderData } from "@/components/reminders/reminder-item";
import { orderCardSelect, toOrderCard } from "@/lib/serialize";
import { bucketOrders, DONE_STATUSES, INACTIVE_STATUSES, reminderWindows } from "@/lib/reminders";
import { cn, startOfDay, endOfDay, dateKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Tab = "orders" | "notes";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "notes" ? "notes" : "orders";
  const isAdmin = user.role === "ADMIN";

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-brand-dark">Reminders</h1>
        {tab === "notes" ? (
          <Link href="/reminders/new"><Button size="sm"><Plus size={16} /> New</Button></Link>
        ) : (
          <Link href="/reminders/archive"><Button size="sm" variant="soft"><Archive size={16} /> Archive</Button></Link>
        )}
      </div>

      <Tabs active={tab} />

      {tab === "notes" ? (
        <NotesTab />
      ) : (
        <OrdersTab isAdmin={isAdmin} branchId={user.branchId ?? null} />
      )}
    </div>
  );
}

function Tabs({ active }: { active: Tab }) {
  const base = "flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition";
  const on = "bg-card text-brand-dark shadow-sm";
  const off = "text-foreground/55 hover:text-foreground/80";
  return (
    <div className="mb-5 flex gap-1 rounded-xl bg-muted p-1">
      <Link href="/reminders" className={cn(base, active === "orders" ? on : off)}>Orders</Link>
      <Link href="/reminders?tab=notes" className={cn(base, active === "notes" ? on : off)}>Notes</Link>
    </div>
  );
}

/* ── Orders tab: orders grouped by due date, shown with the order card ──── */
async function OrdersTab({ isAdmin, branchId }: { isAdmin: boolean; branchId: string | null }) {
  const branchOn = await getBranchManagementEnabled();
  const now = new Date();
  const w = reminderWindows(now);

  // With branch management on, staff see only their own branch; admins see all.
  const branchScope = branchOn && !isAdmin ? { branchId: branchId ?? null } : {};
  const orders = await prisma.order.findMany({
    where: {
      ...branchScope,
      OR: [
        // Active orders due up to the end of the upcoming window (overdue → upcoming).
        { orderStatus: { notIn: [...INACTIVE_STATUSES] }, requiredDate: { lte: w.upcomingEnd } },
        // Everything due today, whatever its status.
        { requiredDate: { gte: w.todayStart, lte: w.todayEnd } },
        // Completed orders within the recent window (and any future completed).
        { orderStatus: { in: [...DONE_STATUSES] }, requiredDate: { gte: w.completedStart } },
      ],
    },
    orderBy: [{ requiredDate: "asc" }, { requiredTime: "asc" }],
    select: orderCardSelect,
  });

  const b = bucketOrders(orders.map(toOrderCard), now);

  const sections: BoardSection[] = [
    { key: "overdue", label: "Overdue", items: b.overdue, empty: "Nothing overdue.", danger: true },
    { key: "today", label: "Today", items: b.today, empty: "No orders due today." },
    { key: "tomorrow", label: "Tomorrow", items: b.tomorrow, empty: "Nothing due tomorrow." },
    { key: "upcoming", label: "Upcoming", items: b.upcoming, empty: "No orders in the next 7 days." },
    { key: "completed", label: "Completed", items: b.completed, empty: "None recently." },
  ];

  return <OrderBoard sections={sections} canEdit={isAdmin} initialKey="today" />;
}

/* ── Notes tab: the custom reminder notes staff create ─────────────────── */
async function NotesTab() {
  const reminders = await prisma.reminder.findMany({
    orderBy: [{ reminderDate: "asc" }, { reminderTime: "asc" }],
    include: { customer: { select: { name: true } }, order: { select: { orderNumber: true } } },
    take: 300,
  });

  const data: ReminderData[] = reminders.map((r) => ({
    id: r.id,
    title: r.title,
    reminderType: r.reminderType,
    reminderDate: r.reminderDate.toISOString(),
    reminderTime: r.reminderTime,
    priority: r.priority,
    status: r.status,
    notes: r.notes,
    customerName: r.customer?.name ?? null,
    orderNumber: r.order?.orderNumber ?? null,
  }));

  const now = new Date();
  const todayStart = startOfDay(now).getTime();
  const todayEnd = endOfDay(now).getTime();
  const todayKey = dateKey(now);

  const pending = data.filter((r) => r.status === "PENDING");
  const today = pending.filter((r) => dateKey(r.reminderDate) === todayKey);
  const overdue = pending.filter((r) => new Date(r.reminderDate).getTime() < todayStart);
  const upcoming = pending.filter((r) => new Date(r.reminderDate).getTime() > todayEnd);
  const completed = data.filter((r) => r.status !== "PENDING");

  return (
    <>
      <NoteGroup title={`Today (${today.length})`} items={today} empty="No reminders for today." />
      <NoteGroup title={`Overdue (${overdue.length})`} items={overdue} empty="Nothing overdue." />
      <NoteGroup title={`Upcoming (${upcoming.length})`} items={upcoming} empty="No upcoming reminders." />
      <NoteGroup title={`Completed (${completed.length})`} items={completed} empty="None yet." muted />
    </>
  );
}

function NoteGroup({ title, items, empty, muted }: { title: string; items: ReminderData[]; empty: string; muted?: boolean }) {
  return (
    <section className="mb-6">
      <h2 className={`mb-2 text-sm font-semibold ${muted ? "text-foreground/40" : "text-foreground/70"}`}>{title}</h2>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-foreground/40">{empty}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((r) => <ReminderItem key={r.id} r={r} />)}
        </div>
      )}
    </section>
  );
}
