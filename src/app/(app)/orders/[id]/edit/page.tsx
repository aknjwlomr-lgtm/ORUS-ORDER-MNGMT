import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, isAdmin } from "@/lib/session";
import {
  getCustomFreshBakeItems, getCustomCakeCategories,
  getCustomCakeFlavors, getCustomCakeShapes, getCustomCakeWeights,
  getBranchManagementEnabled, getStaffMembers,
} from "@/lib/settings";
import { OrderForm, type OrderFormValues, type CakeValues, type BakeItemValues } from "@/components/orders/order-form";
import { dateKey } from "@/lib/utils";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Editing a saved order is admin-only; send staff to the read-only view.
  if (!isAdmin(user)) redirect(`/orders/${id}`);
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      customer: true,
      cakes: { orderBy: { position: "asc" } },
      bakeItems: { orderBy: { position: "asc" } },
    },
  });
  if (!o) notFound();

  const initial: OrderFormValues = {
    customerName: o.customer.name,
    phone: o.customer.phone,
    whatsapp: o.customer.whatsapp ?? "",
    email: o.customer.email ?? "",
    address: o.customer.address ?? "",
    customerType: o.customer.customerType,
    occasion: o.occasion ?? "Birthday",
    customerNotes: o.customer.notes ?? "",
    branchId: o.branchId ?? "",
    assignedStaff: o.assignedStaff ?? "",
    // The toggle is a view switcher with only Cake / Fresh Bakes; a MIXED order
    // opens on the Cake view (both lists are loaded below).
    orderType: o.orderType === "FRESH_BAKES" ? "FRESH_BAKES" : "CAKE",
    bakeItem: o.orderType === "FRESH_BAKES" ? o.cakeCategory : "",
    bakeQuantity: String(o.bakeQuantity ?? 1),
    bakeUnit: o.bakeUnit ?? "PIECE",
    cakeCategory: o.orderType === "FRESH_BAKES" ? "Birthday Cake" : o.cakeCategory,
    cakeFlavor: o.cakeFlavor ?? "",
    cakeShape: o.cakeShape ?? "Round",
    cakeWeight: o.cakeWeight ?? "1kg",
    tiers: String(o.tiers),
    eggOption: o.eggOption,
    sugarFree: o.sugarFree,
    theme: o.theme ?? "",
    colorPreference: o.colorPreference ?? "",
    cakeMessage: o.cakeMessage ?? "",
    designDescription: o.designDescription ?? "",
    specialInstructions: o.specialInstructions ?? "",
    requiredDate: dateKey(o.requiredDate),
    requiredTime: o.requiredTime,
    deliveryType: o.deliveryType,
    deliveryAddress: o.deliveryAddress ?? "",
    deliveryPerson: o.deliveryPerson ?? "",
    priority: o.priority,
    cakePrice: String(o.cakePrice),
    extraCharge: String(o.extraCharge),
    deliveryCharge: String(o.deliveryCharge),
    tax: String(o.tax),
    discount: String(o.discount),
    advancePaid: String(o.advancePaid),
    paymentMode: o.paymentMode ?? "CASH",
    paymentRef: o.paymentRef ?? "",
    billingNotes: o.billingNotes ?? "",
    assignedBaker: o.assignedBaker ?? "",
    assignedDecorator: o.assignedDecorator ?? "",
    prepStatus: o.prepStatus ?? "Pending",
    kitchenNotes: o.kitchenNotes ?? "",
    packagingNotes: o.packagingNotes ?? "",
    staffComments: o.staffComments ?? "",
  };

  // Load whichever lines the order has. A mixed order has both; a pre-multi-line
  // order has none, so fall back to a single line built from the primary columns
  // (only for that order's own type).
  const cakeRows = o.cakes.length > 0 ? o.cakes : o.orderType === "FRESH_BAKES" ? [] : [o];
  const initialCakes: CakeValues[] | undefined =
    cakeRows.length === 0
      ? undefined
      : cakeRows.map((c) => ({
          cakeCategory: c.cakeCategory,
          cakeFlavor: c.cakeFlavor ?? "",
          cakeShape: c.cakeShape ?? "Round",
          cakeWeight: c.cakeWeight ?? "1kg",
          tiers: String(c.tiers),
          eggOption: c.eggOption,
          sugarFree: c.sugarFree,
          theme: c.theme ?? "",
          colorPreference: c.colorPreference ?? "",
          cakeMessage: c.cakeMessage ?? "",
          designDescription: c.designDescription ?? "",
          specialInstructions: c.specialInstructions ?? "",
          price: String("price" in c ? c.price : o.cakePrice),
        }));

  const initialBakeItems: BakeItemValues[] | undefined =
    o.bakeItems.length > 0
      ? o.bakeItems.map((it) => ({
          name: it.name,
          quantity: String(it.quantity),
          unit: it.unit,
          price: String(it.price),
          notes: it.notes ?? "",
        }))
      : o.orderType === "FRESH_BAKES"
        ? [{
            name: o.cakeCategory,
            quantity: String(o.bakeQuantity ?? 1),
            unit: o.bakeUnit ?? "PIECE",
            price: String(o.cakePrice),
            notes: o.specialInstructions ?? "",
          }]
        : undefined;

  const branchOn = await getBranchManagementEnabled();
  const [
    customBakeItems, customCakeCategories,
    customCakeFlavors, customCakeShapes, customCakeWeights, branches, staffMembers,
  ] = await Promise.all([
    getCustomFreshBakeItems(),
    getCustomCakeCategories(),
    getCustomCakeFlavors(),
    getCustomCakeShapes(),
    getCustomCakeWeights(),
    branchOn ? prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    getStaffMembers(),
  ]);
  return (
    <OrderForm
      mode="edit"
      orderId={o.id}
      initial={initial}
      initialCakes={initialCakes}
      initialBakeItems={initialBakeItems}
      customBakeItems={customBakeItems}
      customCakeCategories={customCakeCategories}
      customCakeFlavors={customCakeFlavors}
      customCakeShapes={customCakeShapes}
      customCakeWeights={customCakeWeights}
      branches={branches}
      pickBranch={branchOn}
      staffMembers={staffMembers}
    />
  );
}
