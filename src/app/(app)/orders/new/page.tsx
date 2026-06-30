import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getCustomFreshBakeItems, getCustomCakeCategories,
  getCustomCakeFlavors, getCustomCakeShapes, getCustomCakeWeights,
  getProductTypesEnabled, getBranchManagementEnabled, getStaffMembers, getAppSegment,
  getAdminSectionAccess,
} from "@/lib/settings";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { OrderForm } from "@/components/orders/order-form";
import { LiteOrderForm } from "@/components/orders/lite-order-form";
import { NewOrderTabs } from "@/components/orders/new-order-tabs";

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const branchOn = await getBranchManagementEnabled();
  const pickBranch = isAdmin && branchOn;
  const [
    customBakeItems, customCakeCategories,
    customCakeFlavors, customCakeShapes, customCakeWeights, branches, customerDirectory, productTypes, staffMembers, appSegment, adminAccess,
  ] = await Promise.all([
    getCustomFreshBakeItems(),
    getCustomCakeCategories(),
    getCustomCakeFlavors(),
    getCustomCakeShapes(),
    getCustomCakeWeights(),
    pickBranch ? prisma.branch.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    // Loaded once so phone-number suggestions filter instantly on the client
    // instead of a slow round-trip per keystroke.
    prisma.customer.findMany({
      orderBy: { lastOrderAt: "desc" },
      take: 3000,
      select: { id: true, name: true, phone: true, whatsapp: true, customerType: true, totalOrders: true },
    }),
    getProductTypesEnabled(),
    getStaffMembers(),
    getAppSegment(),
    getAdminSectionAccess(),
  ]);

  // Receipt access (for the success screen's Print-receipt button): global admin
  // always; others only when the global admin enabled it.
  const canReceipt = user.email === GLOBAL_ADMIN_EMAIL || adminAccess.receipt;

  const directory = customerDirectory.map((c) => ({
    id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp ?? "",
    customerType: c.customerType, totalOrders: c.totalOrders,
  }));

  const proForm = (
    <OrderForm
      mode="create"
      defaultDate={sp.date}
      cakesEnabled={productTypes.cakes}
      freshBakesEnabled={productTypes.freshBakes}
      customBakeItems={customBakeItems}
      customCakeCategories={customCakeCategories}
      customCakeFlavors={customCakeFlavors}
      customCakeShapes={customCakeShapes}
      customCakeWeights={customCakeWeights}
      branches={branches}
      pickBranch={pickBranch}
      staffMembers={staffMembers}
      customerDirectory={directory}
      canReceipt={canReceipt}
    />
  );

  const liteForm = (
    <LiteOrderForm
      defaultDate={sp.date}
      cakesEnabled={productTypes.cakes}
      freshBakesEnabled={productTypes.freshBakes}
      customCakeFlavors={customCakeFlavors}
      customBakeItems={customBakeItems}
      branches={branches}
      pickBranch={pickBranch}
      staffMembers={staffMembers}
      customerDirectory={directory}
    />
  );

  // Lite segment → quick form only; Pro segment → both forms as tabs.
  if (appSegment === "LITE") return liteForm;
  return <NewOrderTabs defaultTab="pro" pro={proForm} lite={liteForm} />;
}
