import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import {
  getCustomFreshBakeItems, getCustomCakeCategories,
  getCustomCakeFlavors, getCustomCakeShapes, getCustomCakeWeights,
  getProductTypesEnabled, getBranchManagementEnabled,
} from "@/lib/settings";
import { OrderForm } from "@/components/orders/order-form";

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
    customCakeFlavors, customCakeShapes, customCakeWeights, branches, customerDirectory, productTypes,
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
  ]);
  return (
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
      customerDirectory={customerDirectory.map((c) => ({
        id: c.id, name: c.name, phone: c.phone, whatsapp: c.whatsapp ?? "",
        customerType: c.customerType, totalOrders: c.totalOrders,
      }))}
    />
  );
}
