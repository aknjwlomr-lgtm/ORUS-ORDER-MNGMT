import { prisma } from "@/lib/prisma";
import { getOrderPrefix } from "@/lib/settings";

/** Next sequential order number like ALPHA-ORD-0001, using the configurable prefix. */
export async function nextOrderNumber(): Promise<string> {
  const prefix = await getOrderPrefix();
  const last = await prisma.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });
  let n = 1;
  if (last?.orderNumber) {
    const m = last.orderNumber.match(/(\d+)$/);
    if (m) n = parseInt(m[1], 10) + 1;
  }
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Derive total, balance and payment status from pricing inputs. */
export function computeTotals(p: {
  cakePrice: number;
  extraCharge: number;
  deliveryCharge: number;
  tax: number;
  discount: number;
  advancePaid: number;
}) {
  const total =
    p.cakePrice + p.extraCharge + p.deliveryCharge + p.tax - p.discount;
  const totalAmount = Math.max(0, Math.round(total * 100) / 100);
  const balanceAmount = Math.round((totalAmount - p.advancePaid) * 100) / 100;
  let paymentStatus: "NOT_PAID" | "ADVANCE_PAID" | "FULLY_PAID";
  if (p.advancePaid <= 0) paymentStatus = "NOT_PAID";
  else if (p.advancePaid >= totalAmount) paymentStatus = "FULLY_PAID";
  else paymentStatus = "ADVANCE_PAID";
  return { totalAmount, balanceAmount, paymentStatus };
}
