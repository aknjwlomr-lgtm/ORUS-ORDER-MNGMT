"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/session";
import { nextOrderNumber, computeTotals } from "@/lib/orders";
import { dateKey } from "@/lib/utils";
import { OCCASIONS, FRESH_BAKE_ITEMS, CAKE_CATEGORIES, CAKE_FLAVORS, CAKE_SHAPES, CAKE_WEIGHTS, orderStageIndex } from "@/lib/constants";
import {
  getCustomOccasions, setCustomOccasions,
  getCustomFreshBakeItems, setCustomFreshBakeItems,
  getCustomCakeCategories, setCustomCakeCategories,
  getCustomCakeFlavors, setCustomCakeFlavors,
  getCustomCakeShapes, setCustomCakeShapes,
  getCustomCakeWeights, setCustomCakeWeights,
} from "@/lib/settings";

const num = z.coerce.number().default(0);

/**
 * One cake line within a CAKE order. Each cake carries its own details and
 * price; the order's cakePrice is the sum of these, and the first cake mirrors
 * the order's primary cake columns (cakeCategory, cakeFlavor, …).
 */
const cakeSchema = z.object({
  cakeCategory: z.string().min(1, "Cake category is required"),
  cakeFlavor: z.string().optional(),
  cakeShape: z.string().optional(),
  cakeWeight: z.string().optional(),
  tiers: z.coerce.number().min(1).default(1),
  eggOption: z.enum(["EGG", "EGGLESS"]).default("EGG"),
  sugarFree: z.coerce.boolean().default(false),
  theme: z.string().optional(),
  colorPreference: z.string().optional(),
  cakeMessage: z.string().optional(),
  designDescription: z.string().optional(),
  specialInstructions: z.string().optional(),
  referenceImage: z.string().optional(),
  price: num,
});

/**
 * One item line within a FRESH_BAKES order. Each item has its own quantity, unit
 * and price; the order's cakePrice is the sum, and the first item mirrors the
 * primary columns (cakeCategory = name, bakeQuantity, bakeUnit).
 */
const bakeItemSchema = z.object({
  name: z.string().min(1, "Bakery item is required"),
  quantity: z.coerce.number().gt(0).default(1),
  unit: z.enum(["PIECE", "GRAMS", "KG"]).default("PIECE"),
  price: num,
  notes: z.string().optional(),
});

/** A customer becomes REGULAR at this many orders. */
const REGULAR_THRESHOLD = 5;

/**
 * Customer status is derived from how many orders they've placed:
 *  - NEW: their first order
 *  - EXISTING: they've ordered before
 *  - REGULAR: they order regularly
 */
function tierFor(totalOrders: number): "NEW" | "EXISTING" | "REGULAR" {
  if (totalOrders >= REGULAR_THRESHOLD) return "REGULAR";
  if (totalOrders >= 2) return "EXISTING";
  return "NEW";
}

/** Map validated cake input to Prisma OrderCake create rows, ordered by position. */
function cakeCreateRows(cakes: z.infer<typeof cakeSchema>[] | undefined) {
  if (!cakes?.length) return null;
  return cakes.map((c, i) => ({
    position: i,
    cakeCategory: c.cakeCategory,
    cakeFlavor: c.cakeFlavor || null,
    cakeShape: c.cakeShape || null,
    cakeWeight: c.cakeWeight || null,
    tiers: c.tiers,
    eggOption: c.eggOption,
    sugarFree: c.sugarFree,
    theme: c.theme || null,
    colorPreference: c.colorPreference || null,
    cakeMessage: c.cakeMessage || null,
    designDescription: c.designDescription || null,
    specialInstructions: c.specialInstructions || null,
    referenceImage: c.referenceImage || null,
    price: c.price,
  }));
}

/** Map validated bake-item input to Prisma OrderBakeItem create rows, by position. */
function bakeItemCreateRows(items: z.infer<typeof bakeItemSchema>[] | undefined) {
  if (!items?.length) return null;
  return items.map((it, i) => ({
    position: i,
    name: it.name.trim(),
    quantity: it.quantity,
    unit: it.unit,
    price: it.price,
    notes: it.notes?.trim() || null,
  }));
}

const orderSchema = z.object({
  // customer
  customerName: z.string().min(1, "Customer name is required"),
  phone: z.string().min(6, "Phone number is required"),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  customerType: z.enum(["NEW", "EXISTING", "REGULAR"]).default("NEW"),
  occasion: z.string().optional(),
  customerNotes: z.string().optional(),
  // branch chosen on the form (admins only; staff are stamped with their own)
  branchId: z.string().optional(),
  // product type
  orderType: z.enum(["CAKE", "FRESH_BAKES", "MIXED"]).default("CAKE"),
  bakeItem: z.string().optional(),
  // A cake/MIXED order sends a blank here (the bake quantity lives on each item
  // line). Treat blank as "not provided" so it doesn't fail the >0 check.
  bakeQuantity: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce.number().gt(0).optional()
  ),
  bakeUnit: z.enum(["PIECE", "GRAMS", "KG"]).optional(),
  // cake
  cakeCategory: z.string().optional(),
  cakeFlavor: z.string().optional(),
  cakeShape: z.string().optional(),
  cakeWeight: z.string().optional(),
  tiers: z.coerce.number().min(1).default(1),
  eggOption: z.enum(["EGG", "EGGLESS"]).default("EGG"),
  sugarFree: z.coerce.boolean().default(false),
  theme: z.string().optional(),
  colorPreference: z.string().optional(),
  cakeMessage: z.string().optional(),
  designDescription: z.string().optional(),
  specialInstructions: z.string().optional(),
  referenceImage: z.string().optional(),
  // every cake on a CAKE order (the flat cake fields above mirror the first one)
  cakes: z.array(cakeSchema).optional(),
  // every item on a FRESH_BAKES order (the flat bake fields mirror the first one)
  bakeItems: z.array(bakeItemSchema).optional(),
  // delivery
  requiredDate: z.string().min(1, "Required date is required"),
  requiredTime: z.string().min(1, "Required time is required"),
  deliveryType: z.enum(["PICKUP", "HOME_DELIVERY"]).default("PICKUP"),
  deliveryAddress: z.string().optional(),
  deliveryPerson: z.string().optional(),
  priority: z.enum(["NORMAL", "URGENT", "HIGH", "CRITICAL"]).default("NORMAL"),
  // pricing
  cakePrice: num,
  extraCharge: num,
  deliveryCharge: num,
  tax: num,
  discount: num,
  advancePaid: num,
  paymentMode: z.string().optional(),
  paymentRef: z.string().optional(),
  billingNotes: z.string().optional(),
  // production
  assignedBaker: z.string().optional(),
  assignedDecorator: z.string().optional(),
  prepStatus: z.string().optional(),
  kitchenNotes: z.string().optional(),
  packagingNotes: z.string().optional(),
  staffComments: z.string().optional(),
}).superRefine((d, ctx) => {
  if (d.orderType === "FRESH_BAKES") {
    if (!d.bakeItem?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Bakery item is required", path: ["bakeItem"] });
    }
  } else if (!d.cakeCategory?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cake category is required", path: ["cakeCategory"] });
  }
});

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; error: string };

export async function createOrder(raw: unknown): Promise<CreateOrderResult> {
  const user = await requireUser();
  // A logged-in session can outlive its user (e.g. after a data reset). Catch that
  // here so it shows a clear message instead of a foreign-key "save failed".
  const accountExists = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!accountExists) {
    return { ok: false, error: "Your session has expired — please sign out and sign in again." };
  }
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;

  if (d.deliveryType === "HOME_DELIVERY" && !d.deliveryAddress?.trim() && !d.address?.trim()) {
    return { ok: false, error: "Delivery address is required for home delivery" };
  }

  const totals = computeTotals({
    cakePrice: d.cakePrice,
    extraCharge: d.extraCharge,
    deliveryCharge: d.deliveryCharge,
    tax: d.tax,
    discount: d.discount,
    advancePaid: d.advancePaid,
  });

  if (d.advancePaid > totals.totalAmount) {
    return { ok: false, error: "Advance paid cannot be greater than total amount" };
  }

  const isBake = d.orderType === "FRESH_BAKES";
  const productName = (isBake ? d.bakeItem : d.cakeCategory)!.trim();
  // An order may carry cakes and/or fresh-bake items; create whichever were sent.
  const cakeRows = cakeCreateRows(d.cakes);
  const bakeItemRows = bakeItemCreateRows(d.bakeItems);

  // Branch: staff orders are stamped with the creator's own branch (read fresh
  // from the DB, so reassignment takes effect without re-login). Admins/global
  // users choose a branch on the form (or leave it unassigned).
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true, branchId: true } });
  const branchId = dbUser?.role === "ADMIN" ? (d.branchId || null) : (dbUser?.branchId ?? null);

  // upsert customer by phone
  const customer = await prisma.customer.upsert({
    where: { phone: d.phone.trim() },
    update: {
      name: d.customerName,
      whatsapp: d.whatsapp || undefined,
      email: d.email || undefined,
      address: d.address || undefined,
      notes: d.customerNotes || undefined,
    },
    create: {
      name: d.customerName,
      phone: d.phone.trim(),
      whatsapp: d.whatsapp || null,
      email: d.email || null,
      address: d.address || null,
      customerType: "NEW",
      notes: d.customerNotes || null,
    },
  });

  const orderNumber = await nextOrderNumber();

  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: customer.id,
      branchId,
      requiredDate: new Date(d.requiredDate),
      requiredTime: d.requiredTime,
      occasion: d.occasion || null,
      orderType: d.orderType,
      bakeQuantity: isBake ? (d.bakeQuantity ?? 1) : null,
      bakeUnit: isBake ? (d.bakeUnit ?? "PIECE") : null,
      cakeCategory: productName,
      cakeFlavor: isBake ? null : d.cakeFlavor || null,
      cakeShape: isBake ? null : d.cakeShape || null,
      cakeWeight: isBake ? null : d.cakeWeight || null,
      tiers: isBake ? 1 : d.tiers,
      eggOption: isBake ? "EGG" : d.eggOption,
      sugarFree: isBake ? false : d.sugarFree,
      theme: isBake ? null : d.theme || null,
      colorPreference: isBake ? null : d.colorPreference || null,
      cakeMessage: isBake ? null : d.cakeMessage || null,
      designDescription: isBake ? null : d.designDescription || null,
      specialInstructions: d.specialInstructions || null,
      referenceImage: d.referenceImage || null,
      deliveryType: d.deliveryType,
      deliveryAddress: d.deliveryAddress || d.address || null,
      deliveryCharge: d.deliveryCharge,
      deliveryPerson: d.deliveryPerson || null,
      priority: d.priority,
      cakePrice: d.cakePrice,
      extraCharge: d.extraCharge,
      discount: d.discount,
      tax: d.tax,
      totalAmount: totals.totalAmount,
      advancePaid: d.advancePaid,
      balanceAmount: totals.balanceAmount,
      paymentStatus: totals.paymentStatus,
      paymentMode: d.paymentMode ? (d.paymentMode as never) : null,
      paymentRef: d.paymentRef || null,
      billingNotes: d.billingNotes || null,
      assignedBaker: d.assignedBaker || null,
      assignedDecorator: d.assignedDecorator || null,
      prepStatus: d.prepStatus || null,
      kitchenNotes: d.kitchenNotes || null,
      packagingNotes: d.packagingNotes || null,
      staffComments: d.staffComments || null,
      orderStatus: "CONFIRMED",
      cakeStatus: "CONFIRMED",
      bakeStatus: "CONFIRMED",
      ...(cakeRows ? { cakes: { create: cakeRows } } : {}),
      ...(bakeItemRows ? { bakeItems: { create: bakeItemRows } } : {}),
      createdById: user.id,
      timeline: {
        create: { action: "Order created", newStatus: "CONFIRMED", performedById: user.id },
      },
      ...(d.advancePaid > 0
        ? {
            payments: {
              create: {
                amount: d.advancePaid,
                paymentMode: (d.paymentMode as never) || "CASH",
                paymentRef: d.paymentRef || null,
                paymentNote: "Advance at order creation",
                receivedById: user.id,
              },
            },
          }
        : {}),
    },
  });

  // Order count drives the customer's status (NEW → EXISTING → REGULAR).
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      totalOrders: { increment: 1 },
      totalSpent: { increment: d.advancePaid },
      lastOrderAt: new Date(),
      customerType: tierFor(customer.totalOrders + 1),
    },
  });

  revalidatePath("/orders");
  return { ok: true, orderId: order.id, orderNumber };
}

export async function updateOrder(orderId: string, raw: unknown): Promise<CreateOrderResult> {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: "Only admins can edit a saved order" };
  const accountExists = await prisma.user.findUnique({ where: { id: user.id }, select: { id: true } });
  if (!accountExists) {
    return { ok: false, error: "Your session has expired — please sign out and sign in again." };
  }
  const parsed = orderSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  const d = parsed.data;
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) return { ok: false, error: "Order not found" };

  if (d.deliveryType === "HOME_DELIVERY" && !d.deliveryAddress?.trim() && !d.address?.trim()) {
    return { ok: false, error: "Delivery address is required for home delivery" };
  }

  const totals = computeTotals({
    cakePrice: d.cakePrice,
    extraCharge: d.extraCharge,
    deliveryCharge: d.deliveryCharge,
    tax: d.tax,
    discount: d.discount,
    advancePaid: d.advancePaid,
  });
  if (d.advancePaid > totals.totalAmount) {
    return { ok: false, error: "Advance paid cannot be greater than total amount" };
  }

  const isBake = d.orderType === "FRESH_BAKES";
  const productName = (isBake ? d.bakeItem : d.cakeCategory)!.trim();
  // An order may carry cakes and/or fresh-bake items; create whichever were sent.
  const cakeRows = cakeCreateRows(d.cakes);
  const bakeItemRows = bakeItemCreateRows(d.bakeItems);

  await prisma.customer.update({
    where: { id: existing.customerId },
    data: {
      name: d.customerName,
      whatsapp: d.whatsapp || null,
      email: d.email || null,
      address: d.address || null,
      notes: d.customerNotes || null,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: {
      branchId: d.branchId || null,
      requiredDate: new Date(d.requiredDate),
      requiredTime: d.requiredTime,
      occasion: d.occasion || null,
      orderType: d.orderType,
      bakeQuantity: isBake ? (d.bakeQuantity ?? 1) : null,
      bakeUnit: isBake ? (d.bakeUnit ?? "PIECE") : null,
      cakeCategory: productName,
      cakeFlavor: isBake ? null : d.cakeFlavor || null,
      cakeShape: isBake ? null : d.cakeShape || null,
      cakeWeight: isBake ? null : d.cakeWeight || null,
      tiers: isBake ? 1 : d.tiers,
      eggOption: isBake ? "EGG" : d.eggOption,
      sugarFree: isBake ? false : d.sugarFree,
      theme: isBake ? null : d.theme || null,
      colorPreference: isBake ? null : d.colorPreference || null,
      cakeMessage: isBake ? null : d.cakeMessage || null,
      designDescription: isBake ? null : d.designDescription || null,
      specialInstructions: d.specialInstructions || null,
      deliveryType: d.deliveryType,
      deliveryAddress: d.deliveryAddress || d.address || null,
      deliveryCharge: d.deliveryCharge,
      deliveryPerson: d.deliveryPerson || null,
      priority: d.priority,
      cakePrice: d.cakePrice,
      extraCharge: d.extraCharge,
      discount: d.discount,
      tax: d.tax,
      totalAmount: totals.totalAmount,
      advancePaid: d.advancePaid,
      balanceAmount: totals.balanceAmount,
      paymentStatus: totals.paymentStatus,
      paymentMode: d.paymentMode ? (d.paymentMode as never) : null,
      paymentRef: d.paymentRef || null,
      billingNotes: d.billingNotes || null,
      assignedBaker: d.assignedBaker || null,
      assignedDecorator: d.assignedDecorator || null,
      prepStatus: d.prepStatus || null,
      kitchenNotes: d.kitchenNotes || null,
      packagingNotes: d.packagingNotes || null,
      staffComments: d.staffComments || null,
      updatedById: user.id,
      // Replace the cake / bake-item lists wholesale on edit.
      cakes: cakeRows ? { deleteMany: {}, create: cakeRows } : { deleteMany: {} },
      bakeItems: bakeItemRows ? { deleteMany: {}, create: bakeItemRows } : { deleteMany: {} },
      timeline: { create: { action: "Order edited", performedById: user.id } },
    },
  });

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, orderId, orderNumber: existing.orderNumber };
}

/** Overall status from the active product tracks: the least-advanced one, or
 *  CANCELLED only when every active track is cancelled. */
function overallStatus(statuses: string[]): string {
  const active = statuses.length ? statuses : ["CONFIRMED"];
  const live = active.filter((s) => s !== "CANCELLED");
  if (live.length === 0) return "CANCELLED";
  return live.reduce((min, s) => (orderStageIndex(s) < orderStageIndex(min) ? s : min));
}

/**
 * Update an order's status. With a `track` ("cake" | "bake") it advances just that
 * product's progress and re-derives the overall orderStatus; without a track it
 * sets the whole order (both tracks) — e.g. a card cancel/reopen.
 */
export async function updateOrderStatus(orderId: string, newStatus: string, track?: "cake" | "bake") {
  const user = await requireUser();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };

  const data: Record<string, unknown> = { updatedById: user.id };
  if (track === "cake") data.cakeStatus = newStatus;
  else if (track === "bake") data.bakeStatus = newStatus;

  if (track) {
    // Re-derive the overall status from the active product tracks.
    const cake = track === "cake" ? newStatus : order.cakeStatus;
    const bake = track === "bake" ? newStatus : order.bakeStatus;
    const active: string[] = [];
    if (order.orderType === "CAKE" || order.orderType === "MIXED") active.push(cake);
    if (order.orderType === "FRESH_BAKES" || order.orderType === "MIXED") active.push(bake);
    data.orderStatus = overallStatus(active);
  } else {
    // Whole-order change: keep everything in sync.
    data.orderStatus = newStatus;
    data.cakeStatus = newStatus;
    data.bakeStatus = newStatus;
  }

  await prisma.order.update({ where: { id: orderId }, data: data as never });
  await prisma.orderTimeline.create({
    data: {
      orderId,
      action: track ? `${track === "cake" ? "Cake" : "Fresh bakes"} status changed` : "Status changed",
      oldStatus: order.orderStatus,
      newStatus,
      performedById: user.id,
    },
  });
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

export async function addPayment(
  orderId: string,
  amount: number,
  paymentMode: string,
  paymentRef?: string
) {
  const user = await requireUser();
  if (!(amount > 0)) return { ok: false, error: "Amount must be greater than 0" };
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };

  await prisma.payment.create({
    data: {
      orderId,
      amount,
      paymentMode: paymentMode as never,
      paymentRef: paymentRef || null,
      receivedById: user.id,
    },
  });

  const advancePaid = order.advancePaid + amount;
  const balanceAmount = Math.round((order.totalAmount - advancePaid) * 100) / 100;
  const paymentStatus =
    advancePaid <= 0 ? "NOT_PAID" : advancePaid >= order.totalAmount ? "FULLY_PAID" : "ADVANCE_PAID";

  await prisma.order.update({
    where: { id: orderId },
    data: { advancePaid, balanceAmount, paymentStatus, updatedById: user.id },
  });
  await prisma.orderTimeline.create({
    data: {
      orderId,
      action: `Payment received (₹${amount})`,
      note: paymentMode,
      performedById: user.id,
    },
  });
  await prisma.customer.update({
    where: { id: order.customerId },
    data: { totalSpent: { increment: amount } },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  return { ok: true };
}

export async function deleteOrder(orderId: string) {
  const user = await requireUser();
  if (!isAdmin(user)) return { ok: false, error: "Only admins can delete orders" };
  await prisma.order.delete({ where: { id: orderId } });
  revalidatePath("/orders");
  return { ok: true };
}

/** Look up an existing customer by phone for auto-fill in the new order form. */
export async function lookupCustomer(phone: string) {
  if (!phone || phone.trim().length < 4) return null;
  const c = await prisma.customer.findUnique({
    where: { phone: phone.trim() },
    include: {
      orders: {
        orderBy: { requiredDate: "desc" },
        take: 5,
        select: { orderNumber: true, cakeCategory: true, requiredDate: true, totalAmount: true },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    whatsapp: c.whatsapp,
    email: c.email,
    address: c.address,
    customerType: c.customerType,
    notes: c.notes,
    totalOrders: c.totalOrders,
    recentOrders: c.orders.map((o) => ({
      orderNumber: o.orderNumber,
      cakeCategory: o.cakeCategory,
      requiredDate: o.requiredDate.toISOString(),
      totalAmount: o.totalAmount,
    })),
  };
}

/** Up to 3 customer suggestions matched by partial phone (or name) for the new order form. */
export async function searchCustomers(query: string) {
  const q = query.trim();
  if (q.length < 3) return [];
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { phone: { contains: q } },
        { whatsapp: { contains: q } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    orderBy: [{ lastOrderAt: "desc" }, { name: "asc" }],
    take: 3,
    select: { id: true, name: true, phone: true, customerType: true, totalOrders: true },
  });
  return customers;
}

type OccasionResult = { ok: true; occasions: string[] } | { ok: false; error: string };

/** Add a custom occasion so it persists in the dropdown for future orders. */
export async function addCustomOccasion(name: string): Promise<OccasionResult> {
  await requireUser();
  const n = name.trim();
  if (!n) return { ok: false, error: "Occasion cannot be empty" };
  if (n.length > 40) return { ok: false, error: "Occasion must be 40 characters or fewer" };

  const custom = await getCustomOccasions();
  const lower = n.toLowerCase();
  if (OCCASIONS.some((o) => o.toLowerCase() === lower) || custom.some((o) => o.toLowerCase() === lower)) {
    return { ok: false, error: "That occasion already exists" };
  }

  const updated = [...custom, n];
  await setCustomOccasions(updated);
  return { ok: true, occasions: updated };
}

/** Remove a previously added custom occasion. Built-in occasions cannot be removed. */
export async function removeCustomOccasion(name: string): Promise<OccasionResult> {
  await requireUser();
  const custom = await getCustomOccasions();
  const updated = custom.filter((o) => o !== name);
  await setCustomOccasions(updated);
  return { ok: true, occasions: updated };
}

type BakeItemResult = { ok: true; items: string[] } | { ok: false; error: string };

/** Add a Fresh Bakes item so it persists in the picker for future orders. */
export async function addFreshBakeItem(name: string): Promise<BakeItemResult> {
  await requireUser();
  const n = name.trim();
  if (!n) return { ok: false, error: "Item cannot be empty" };
  if (n.length > 40) return { ok: false, error: "Item must be 40 characters or fewer" };

  const custom = await getCustomFreshBakeItems();
  const lower = n.toLowerCase();
  if (FRESH_BAKE_ITEMS.some((o) => o.toLowerCase() === lower) || custom.some((o) => o.toLowerCase() === lower)) {
    return { ok: false, error: "That item already exists" };
  }

  const updated = [...custom, n];
  await setCustomFreshBakeItems(updated);
  return { ok: true, items: updated };
}

/** Remove a previously added Fresh Bakes item. Built-in items cannot be removed. */
export async function removeFreshBakeItem(name: string): Promise<BakeItemResult> {
  await requireUser();
  const custom = await getCustomFreshBakeItems();
  const updated = custom.filter((o) => o !== name);
  await setCustomFreshBakeItems(updated);
  return { ok: true, items: updated };
}

type CakeCategoryResult = { ok: true; categories: string[] } | { ok: false; error: string };

/** Add a cake category so it persists in the dropdown for future orders. */
export async function addCakeCategory(name: string): Promise<CakeCategoryResult> {
  await requireUser();
  const n = name.trim();
  if (!n) return { ok: false, error: "Category cannot be empty" };
  if (n.length > 40) return { ok: false, error: "Category must be 40 characters or fewer" };

  const custom = await getCustomCakeCategories();
  const lower = n.toLowerCase();
  if (CAKE_CATEGORIES.some((o) => o.toLowerCase() === lower) || custom.some((o) => o.toLowerCase() === lower)) {
    return { ok: false, error: "That category already exists" };
  }

  const updated = [...custom, n];
  await setCustomCakeCategories(updated);
  return { ok: true, categories: updated };
}

/** Remove a previously added cake category. Built-in categories cannot be removed. */
export async function removeCakeCategory(name: string): Promise<CakeCategoryResult> {
  await requireUser();
  const custom = await getCustomCakeCategories();
  const updated = custom.filter((o) => o !== name);
  await setCustomCakeCategories(updated);
  return { ok: true, categories: updated };
}

/**
 * Result shape shared by the cake-attribute pickers (flavor / shape / weight),
 * which the generic AttributePicker consumes with a uniform `list` key.
 */
export type AttributeResult = { ok: true; list: string[] } | { ok: false; error: string };

/** Add a custom value to a cake-attribute list (flavor / shape / weight). */
async function addCakeAttribute(
  name: string,
  label: string,
  base: readonly string[],
  get: () => Promise<string[]>,
  setList: (list: string[]) => Promise<void>,
): Promise<AttributeResult> {
  await requireUser();
  const n = name.trim();
  if (!n) return { ok: false, error: `${label} cannot be empty` };
  if (n.length > 40) return { ok: false, error: `${label} must be 40 characters or fewer` };

  const custom = await get();
  const lower = n.toLowerCase();
  if (base.some((o) => o.toLowerCase() === lower) || custom.some((o) => o.toLowerCase() === lower)) {
    return { ok: false, error: `That ${label.toLowerCase()} already exists` };
  }

  const updated = [...custom, n];
  await setList(updated);
  return { ok: true, list: updated };
}

/** Remove a custom value from a cake-attribute list. Built-in values can't be removed. */
async function removeCakeAttribute(
  name: string,
  get: () => Promise<string[]>,
  setList: (list: string[]) => Promise<void>,
): Promise<AttributeResult> {
  await requireUser();
  const custom = await get();
  const updated = custom.filter((o) => o !== name);
  await setList(updated);
  return { ok: true, list: updated };
}

export async function addCakeFlavor(name: string): Promise<AttributeResult> {
  return addCakeAttribute(name, "Flavor", CAKE_FLAVORS, getCustomCakeFlavors, setCustomCakeFlavors);
}
export async function removeCakeFlavor(name: string): Promise<AttributeResult> {
  return removeCakeAttribute(name, getCustomCakeFlavors, setCustomCakeFlavors);
}

export async function addCakeShape(name: string): Promise<AttributeResult> {
  return addCakeAttribute(name, "Shape", CAKE_SHAPES, getCustomCakeShapes, setCustomCakeShapes);
}
export async function removeCakeShape(name: string): Promise<AttributeResult> {
  return removeCakeAttribute(name, getCustomCakeShapes, setCustomCakeShapes);
}

export async function addCakeWeight(name: string): Promise<AttributeResult> {
  return addCakeAttribute(name, "Weight", CAKE_WEIGHTS, getCustomCakeWeights, setCustomCakeWeights);
}
export async function removeCakeWeight(name: string): Promise<AttributeResult> {
  return removeCakeAttribute(name, getCustomCakeWeights, setCustomCakeWeights);
}

/**
 * Order counts per day for a "YYYY-MM-DD" date range (inclusive), keyed by day,
 * respecting branch visibility (staff see only their branch). Used by the Orders
 * mini-calendar to show how many orders fall on each date.
 */
export async function getOrderCountsByDay(
  startKey: string,
  endKey: string
): Promise<Record<string, number>> {
  const user = await requireUser();
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  if (!sy || !ey) return {};
  const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
  const end = new Date(ey, em - 1, ed, 23, 59, 59, 999);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { role: true, branchId: true },
  });
  const where = {
    requiredDate: { gte: start, lte: end },
    ...(dbUser?.role === "ADMIN" ? {} : { branchId: dbUser?.branchId ?? null }),
  };

  const rows = await prisma.order.findMany({ where, select: { requiredDate: true } });
  const counts: Record<string, number> = {};
  for (const r of rows) {
    const k = dateKey(r.requiredDate);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}
