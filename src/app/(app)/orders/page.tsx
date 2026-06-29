import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getBranchManagementEnabled, getCustomCakeCategories, getCustomFreshBakeItems } from "@/lib/settings";
import { orderCardSelect, toOrderCard } from "@/lib/serialize";
import { WeekAgenda } from "@/components/calendar/week-agenda";
import { CAKE_CATEGORIES, FRESH_BAKE_ITEMS } from "@/lib/constants";
import { dateKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const branchOn = await getBranchManagementEnabled();

  // Anchor day (defaults to today); the visible week is the Sun–Sat around it.
  const now = new Date();
  const anchorKey = sp.d ?? dateKey(now);
  const [ay, am, ad] = anchorKey.split("-").map(Number);
  const anchor = new Date(ay, am - 1, ad);
  const weekStart = new Date(ay, am - 1, ad - anchor.getDay(), 0, 0, 0, 0);
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6, 23, 59, 59, 999);

  // With branch management on: staff see only their own branch's orders; admins
  // see every branch and can filter client-side. With it off, no scoping/filter.
  const where = {
    requiredDate: { gte: weekStart, lte: weekEnd },
    ...(branchOn && !isAdmin ? { branchId: user.branchId ?? null } : {}),
  };

  const [orders, branches, customCakeCategories, customFreshBakeItems] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ requiredDate: "asc" }, { requiredTime: "asc" }],
      select: orderCardSelect,
    }),
    branchOn && isAdmin
      ? prisma.branch.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    getCustomCakeCategories(),
    getCustomFreshBakeItems(),
  ]);

  const cards = orders.map(toOrderCard);
  // Built-in cake categories / bakery items plus any staff added in Settings, so
  // the filters list everything an order could actually have (deduped).
  const cakeCategories = Array.from(new Set([...CAKE_CATEGORIES, ...customCakeCategories]));
  const freshBakeItems = Array.from(new Set([...FRESH_BAKE_ITEMS, ...customFreshBakeItems]));

  // today's due reminders alert
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const dueReminders = await prisma.reminder.count({
    where: { reminderDate: { gte: todayStart, lte: todayEnd }, status: "PENDING" },
  });

  return (
    <WeekAgenda
      weekStartKey={dateKey(weekStart)}
      orders={cards}
      selectedDate={anchorKey}
      dueReminders={dueReminders}
      canEdit={isAdmin}
      branches={branches}
      cakeCategories={cakeCategories}
      freshBakeItems={freshBakeItems}
      initialQuery={sp.q ?? ""}
    />
  );
}
