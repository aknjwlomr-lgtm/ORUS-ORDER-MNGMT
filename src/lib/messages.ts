import { inr, formatDate } from "@/lib/utils";

export type MsgOrder = {
  orderNumber: string;
  customerName: string;
  requiredDate: string | Date;
  requiredTime: string;
  totalAmount: number;
  advancePaid: number;
  balanceAmount: number;
};

function digits(phone?: string | null): string {
  const d = (phone ?? "").replace(/\D/g, "");
  // assume Indian numbers; prefix 91 if a bare 10-digit number
  if (d.length === 10) return "91" + d;
  return d;
}

export function waLink(phone: string | null | undefined, text: string): string {
  return `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string | null | undefined): string {
  return `tel:${(phone ?? "").replace(/\s/g, "")}`;
}

export function orderConfirmationText(o: MsgOrder, appName = "Orus Bakery"): string {
  return (
    `Hi ${o.customerName}, your cake order ${o.orderNumber} at ${appName} is confirmed ` +
    `for ${formatDate(o.requiredDate)} at ${o.requiredTime}. ` +
    `Total amount: ${inr(o.totalAmount)}. Advance paid: ${inr(o.advancePaid)}. ` +
    `Balance: ${inr(o.balanceAmount)}. Thank you for ordering from ${appName}.`
  );
}

export function paymentReminderText(o: MsgOrder, appName = "Orus Bakery"): string {
  return (
    `Hi ${o.customerName}, a gentle reminder for your ${appName} order ${o.orderNumber}. ` +
    `Balance pending: ${inr(o.balanceAmount)}. Kindly clear it before delivery on ` +
    `${formatDate(o.requiredDate)}. Thank you!`
  );
}

export function deliveryReminderText(o: MsgOrder, appName = "Orus Bakery"): string {
  return (
    `Hi ${o.customerName}, your ${appName} cake (${o.orderNumber}) is scheduled for ` +
    `${formatDate(o.requiredDate)} at ${o.requiredTime}. We look forward to serving you!`
  );
}
