import { Users, SlidersHorizontal, Building2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { getOrderPrefix, getAppName, getMasterLockdown, getMasterLockdownManual, getAutoLockdownAt, getProductTypesEnabled, getBranchManagementEnabled, getStaffMembers, getOrderMode, getAdminSectionAccess } from "@/lib/settings";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import { MasterLockdownCard } from "@/components/settings/master-lockdown-card";
import { OrderModeCard } from "@/components/settings/order-mode-card";
import { AdminAccessCard } from "@/components/settings/admin-access-card";
import { SetupGuide } from "@/components/settings/setup-guide";
import { UserManagementTabs } from "@/components/settings/user-management-tabs";
import { AdminUsersPanel, type AdminUser } from "@/components/settings/admin-users-panel";
import { OrderPrefixForm } from "@/components/settings/order-prefix-form";
import { AppNameForm } from "@/components/settings/app-name-form";
import { ProductTypesForm } from "@/components/settings/product-types-form";
import { StaffPanel } from "@/components/settings/staff-panel";
import { DataResetPanel } from "@/components/settings/data-reset-panel";
import { DataRetentionPanel } from "@/components/settings/data-retention-panel";
import { SettingsNav, type SettingsSection } from "@/components/settings/settings-nav";
import { BranchPanel, type BranchRow, type BranchUser } from "@/components/settings/branch-panel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAdmin();

  const isGlobalAdmin = user.email === GLOBAL_ADMIN_EMAIL;

  // Fetch everything that's independent in parallel — one round-trip's worth of
  // latency instead of ~10 sequential queries to a remote DB.
  const [orderPrefix, appName, productTypes, branchEnabled, staff, allRows, branchRows, adminAccess] = await Promise.all([
    getOrderPrefix(),
    getAppName(),
    getProductTypesEnabled(),
    getBranchManagementEnabled(),
    getStaffMembers(),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.branch.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } }),
    getAdminSectionAccess(),
  ]);

  // Which sections a regular admin may see (global admin always sees all). General
  // is always visible.
  const canSeeUsers = isGlobalAdmin || adminAccess.userManagement;
  const canSeeBranches = isGlobalAdmin || adminAccess.branchManagement;

  // Lockdown info (global admin only). getMasterLockdown may convert a fired
  // timer, so run it first, then read the two flags in parallel.
  let lockdown = false;
  let autoLockdownAt: string | null = null;
  let orderMode: Awaited<ReturnType<typeof getOrderMode>> = "PRO";
  if (isGlobalAdmin) {
    await getMasterLockdown();
    const [manual, at, mode] = await Promise.all([getMasterLockdownManual(), getAutoLockdownAt(), getOrderMode()]);
    lockdown = manual;
    autoLockdownAt = at?.toISOString() ?? null;
    orderMode = mode;
  }

  // Only the global admin can see/manage the global admin account. Other admins
  // never see its row (or reset its password).
  const rows = isGlobalAdmin ? allRows : allRows.filter((u) => u.email !== GLOBAL_ADMIN_EMAIL);
  const users: AdminUser[] = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
    permProcess: u.permProcess,
    permDeliverCancel: u.permDeliverCancel,
    permRecordPayment: u.permRecordPayment,
    permDeleteOrder: u.permDeleteOrder,
  }));

  const branches: BranchRow[] = branchRows.map((b) => ({ id: b.id, name: b.name, userCount: b._count.users }));
  const branchUsers: BranchUser[] = rows.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, branchId: u.branchId }));

  const sections: SettingsSection[] = [];

  if (canSeeUsers) {
    sections.push({
      key: "users",
      label: "User management",
      icon: <Users size={18} />,
      content: (
        <UserManagementTabs
          showGlobal={isGlobalAdmin}
          userContent={<AdminUsersPanel users={users} currentUserId={user.id} />}
          globalContent={isGlobalAdmin ? (
            <div className="space-y-4">
              <AdminAccessCard
                userManagement={adminAccess.userManagement}
                branchManagement={adminAccess.branchManagement}
                reports={adminAccess.reports}
                customers={adminAccess.customers}
              />
              <OrderModeCard current={orderMode} />
              <MasterLockdownCard enabled={lockdown} autoLockdownAt={autoLockdownAt} />
              <SetupGuide />
              <DataResetPanel />
            </div>
          ) : null}
        />
      ),
    });
  }

  if (canSeeBranches) {
    sections.push({
      key: "branches",
      label: "Branch management",
      icon: <Building2 size={18} />,
      content: <BranchPanel enabled={branchEnabled} branches={branches} users={branchUsers} />,
    });
  }

  // General is always available to every admin.
  sections.push({
    key: "general",
    label: "General",
    icon: <SlidersHorizontal size={18} />,
    content: (
      <div className="space-y-4">
        <AppNameForm current={appName} />
        <OrderPrefixForm current={orderPrefix} />
        <StaffPanel staff={staff} />
        <ProductTypesForm cakes={productTypes.cakes} freshBakes={productTypes.freshBakes} />
        <DataRetentionPanel />
      </div>
    ),
  });

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 md:px-6">
      <h1 className="mb-1 text-xl font-bold text-brand-dark">Settings</h1>
      <p className="mb-4 text-sm text-foreground/50">Signed in as {user.name} · Administrator</p>

      <SettingsNav sections={sections} />
    </div>
  );
}
