import type { OrderCardData } from "@/components/orders/order-card";

type OrderWithCustomer = {
  id: string;
  orderNumber: string;
  orderType: string;
  bakeQuantity: number | null;
  bakeUnit: string | null;
  cakeCategory: string;
  cakeFlavor: string | null;
  cakeWeight: string | null;
  cakeMessage: string | null;
  requiredDate: Date;
  requiredTime: string;
  orderStatus: string;
  cakeStatus: string;
  bakeStatus: string;
  paymentStatus: string;
  balanceAmount: number;
  totalAmount: number;
  advancePaid: number;
  deliveryType: string;
  branchId: string | null;
  branch: { name: string } | null;
  customer: { name: string; phone: string; whatsapp: string | null };
  cakes: { cakeCategory: string; cakeFlavor: string | null; cakeWeight: string | null; cakeMessage: string | null }[];
  bakeItems: { name: string; quantity: number; unit: string }[];
};

export function toOrderCard(o: OrderWithCustomer): OrderCardData {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customer.name,
    phone: o.customer.phone,
    whatsapp: o.customer.whatsapp,
    orderType: o.orderType,
    bakeQuantity: o.bakeQuantity,
    bakeUnit: o.bakeUnit,
    cakeCategory: o.cakeCategory,
    cakeFlavor: o.cakeFlavor,
    cakeWeight: o.cakeWeight,
    cakeMessage: o.cakeMessage,
    requiredDate: o.requiredDate.toISOString(),
    requiredTime: o.requiredTime,
    orderStatus: o.orderStatus,
    cakeStatus: o.cakeStatus,
    bakeStatus: o.bakeStatus,
    paymentStatus: o.paymentStatus,
    balanceAmount: o.balanceAmount,
    totalAmount: o.totalAmount,
    advancePaid: o.advancePaid,
    deliveryType: o.deliveryType,
    branchId: o.branchId,
    branchName: o.branch?.name ?? null,
    cakes: o.cakes.map((c) => ({ cakeCategory: c.cakeCategory, cakeFlavor: c.cakeFlavor, cakeWeight: c.cakeWeight, cakeMessage: c.cakeMessage })),
    bakeItems: o.bakeItems.map((b) => ({ name: b.name, quantity: b.quantity, unit: b.unit })),
  };
}

export const orderCardSelect = {
  id: true,
  orderNumber: true,
  orderType: true,
  bakeQuantity: true,
  bakeUnit: true,
  cakeCategory: true,
  cakeFlavor: true,
  cakeWeight: true,
  cakeMessage: true,
  requiredDate: true,
  requiredTime: true,
  orderStatus: true,
  cakeStatus: true,
  bakeStatus: true,
  paymentStatus: true,
  balanceAmount: true,
  totalAmount: true,
  advancePaid: true,
  deliveryType: true,
  branchId: true,
  branch: { select: { name: true } },
  customer: { select: { name: true, phone: true, whatsapp: true } },
  // Every product line on the order, so the card can show cakes AND fresh bakes
  // (a MIXED order has both); falls back to the primary columns for older orders.
  cakes: { select: { cakeCategory: true, cakeFlavor: true, cakeWeight: true, cakeMessage: true }, orderBy: { position: "asc" } },
  bakeItems: { select: { name: true, quantity: true, unit: true }, orderBy: { position: "asc" } },
} as const;
