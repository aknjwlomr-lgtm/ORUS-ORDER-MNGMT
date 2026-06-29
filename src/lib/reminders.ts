import type { OrderStatus } from "@/generated/prisma";
import type { OrderCardData } from "@/components/orders/order-card";
import { startOfDay, endOfDay } from "@/lib/utils";

/** Orders in these statuses are treated as completed/done. */
export const DONE_STATUSES: readonly OrderStatus[] = ["DELIVERED", "PAYMENT_CLOSED"];

/** Statuses kept out of the active date sections (completed + cancelled). */
export const INACTIVE_STATUSES: readonly OrderStatus[] = ["DELIVERED", "PAYMENT_CLOSED", "CANCELLED"];

/** Days of completed orders kept on the board before they move to the archive. */
export const COMPLETED_WINDOW_DAYS = 5;

/** How many days ahead the "Upcoming" section reaches. */
export const UPCOMING_DAYS = 7;

export type ReminderWindows = {
  todayStart: Date;
  todayEnd: Date;
  tomorrowStart: Date;
  tomorrowEnd: Date;
  upcomingEnd: Date;
  completedStart: Date;
};

/** Day boundaries the reminder board is built from, anchored on `now`. */
export function reminderWindows(now: Date): ReminderWindows {
  const dayAt = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  return {
    todayStart: startOfDay(now),
    todayEnd: endOfDay(now),
    tomorrowStart: startOfDay(dayAt(1)),
    tomorrowEnd: endOfDay(dayAt(1)),
    upcomingEnd: endOfDay(dayAt(UPCOMING_DAYS)),
    completedStart: startOfDay(dayAt(-COMPLETED_WINDOW_DAYS)),
  };
}

const isDone = (status: string) => (DONE_STATUSES as readonly string[]).includes(status);

export type OrderBuckets = {
  overdue: OrderCardData[];
  today: OrderCardData[];
  tomorrow: OrderCardData[];
  upcoming: OrderCardData[];
  completed: OrderCardData[];
};

/**
 * Sort fetched order cards into the reminder sections by required date:
 *  - `today` shows every order due today, whatever its status;
 *  - `overdue` / `tomorrow` / `upcoming` show only still-active orders;
 *  - `completed` shows done orders from the recent window (today's already live in
 *    `today`), most-recently-due first.
 * Orders completed before the window, and cancelled ones not due today, are left
 * out — the archive page covers older completed orders.
 */
export function bucketOrders(cards: OrderCardData[], now: Date): OrderBuckets {
  const w = reminderWindows(now);
  const buckets: OrderBuckets = { overdue: [], today: [], tomorrow: [], upcoming: [], completed: [] };

  for (const c of cards) {
    const t = new Date(c.requiredDate).getTime();

    if (t >= w.todayStart.getTime() && t <= w.todayEnd.getTime()) {
      buckets.today.push(c); // all of today, any status
    } else if (isDone(c.orderStatus)) {
      if (t >= w.completedStart.getTime()) buckets.completed.push(c);
    } else if (c.orderStatus === "CANCELLED") {
      // cancelled and not due today — not shown on the board
    } else if (t < w.todayStart.getTime()) {
      buckets.overdue.push(c);
    } else if (t <= w.tomorrowEnd.getTime()) {
      buckets.tomorrow.push(c);
    } else if (t <= w.upcomingEnd.getTime()) {
      buckets.upcoming.push(c); // day after tomorrow … +7 days
    }
    // active orders beyond the upcoming window stay out of view for now
  }

  // Completed: most-recently-due first; the active sections keep query order (asc).
  buckets.completed.sort(
    (a, b) => new Date(b.requiredDate).getTime() - new Date(a.requiredDate).getTime()
  );
  return buckets;
}
