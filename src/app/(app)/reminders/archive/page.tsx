import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getBranchManagementEnabled } from "@/lib/settings";
import { OrderCard } from "@/components/orders/order-card";
import { orderCardSelect, toOrderCard } from "@/lib/serialize";
import { COMPLETED_WINDOW_DAYS, DONE_STATUSES, reminderWindows } from "@/lib/reminders";

export const dynamic = "force-dynamic";

export default async function ReminderArchivePage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const branchOn = await getBranchManagementEnabled();
  const now = new Date();
  const w = reminderWindows(now);

  // Completed orders that have aged out of the board's recent window.
  const orders = await prisma.order.findMany({
    where: {
      ...(branchOn && !isAdmin ? { branchId: user.branchId ?? null } : {}),
      orderStatus: { in: [...DONE_STATUSES] },
      requiredDate: { lt: w.completedStart },
    },
    orderBy: [{ requiredDate: "desc" }, { requiredTime: "asc" }],
    take: 200,
    select: orderCardSelect,
  });

  const cards = orders.map(toOrderCard);

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 md:px-6">
      <div className="mb-1 flex items-center gap-2">
        <Link
          href="/reminders"
          aria-label="Back to reminders"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/60 transition hover:bg-muted"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-brand-dark">Archive</h1>
      </div>
      <p className="mb-4 pl-10 text-sm text-foreground/50">
        Completed orders older than {COMPLETED_WINDOW_DAYS} days.
      </p>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-foreground/40">
          Nothing archived yet.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {cards.map((o) => <OrderCard key={o.id} o={o} canEdit={isAdmin} />)}
        </div>
      )}
    </div>
  );
}
