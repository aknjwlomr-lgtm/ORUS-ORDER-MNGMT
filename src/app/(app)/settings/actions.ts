"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isAdmin } from "@/lib/session";
import {
  ORDER_PREFIX_KEY, APP_NAME_KEY, setSetting, setMasterLockdown, setAutoLockdownAt,
  getProductTypesEnabled, setProductTypeEnabled, setBranchManagementEnabled,
  getStaffMembers, setStaffMembers, setOrderMode, type OrderMode,
} from "@/lib/settings";
import { GLOBAL_ADMIN_EMAIL, RETENTION_OPTIONS } from "@/lib/constants";

type Result = { ok: true } | { ok: false; error: string };

const MIN = 6;

/** Any logged-in user changes their own password. */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<Result> {
  const sessionUser = await requireUser();
  if (newPassword.length < MIN) return { ok: false, error: `New password must be at least ${MIN} characters` };

  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) return { ok: false, error: "User not found" };

  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) return { ok: false, error: "Current password is incorrect" };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  return { ok: true };
}

/** Admin sets/resets a password for any user (staff or admin). */
export async function adminSetUserPassword(userId: string, newPassword: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can set other users' passwords" };
  if (newPassword.length < MIN) return { ok: false, error: `Password must be at least ${MIN} characters` };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found" };
  // Only the global admin may change the global admin's password.
  if (target.email === GLOBAL_ADMIN_EMAIL && sessionUser.email !== GLOBAL_ADMIN_EMAIL) {
    return { ok: false, error: "Only the global admin can change the global admin's password" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });
  revalidatePath("/settings");
  return { ok: true };
}

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z.string().min(MIN, `Password must be at least ${MIN} characters`),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

/** Admin creates a new user. */
export async function adminCreateUser(raw: unknown): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can create users" };

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid data" };
  const d = parsed.data;

  const email = d.email.trim().toLowerCase();
  if (email === GLOBAL_ADMIN_EMAIL) return { ok: false, error: "That email is reserved for the global admin" };
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { ok: false, error: "A user with this email already exists" };

  await prisma.user.create({
    data: {
      name: d.name,
      email,
      role: d.role,
      status: "ACTIVE",
      passwordHash: await bcrypt.hash(d.password, 10),
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

/** Admin sets the order-number prefix (e.g. "ALPHA-ORD-" → ALPHA-ORD-0001). */
export async function updateOrderPrefix(prefix: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can change settings" };

  const p = prefix.trim(); // blank is allowed = no prefix
  if (p.length > 20) return { ok: false, error: "Prefix must be 20 characters or fewer" };

  await setSetting(ORDER_PREFIX_KEY, p);
  revalidatePath("/settings");
  return { ok: true };
}

/** Admin sets the business / app name shown across the app (default "Alpha Bakery"). */
export async function updateAppName(name: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can change settings" };

  const n = name.trim();
  if (!n) return { ok: false, error: "App name cannot be empty" };
  if (n.length > 40) return { ok: false, error: "App name must be 40 characters or fewer" };

  await setSetting(APP_NAME_KEY, n);
  // The name appears in the root layout (nav, metadata) on every page.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Admin enables/disables a product type (cakes / fresh bakes) for new orders.
 * At least one type must stay enabled, otherwise no orders could be created.
 */
export async function updateProductTypeEnabled(
  type: "cakes" | "freshBakes",
  enabled: boolean
): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can change settings" };

  if (!enabled) {
    const flags = await getProductTypesEnabled();
    const other = type === "cakes" ? flags.freshBakes : flags.cakes;
    if (!other) return { ok: false, error: "At least one order type must stay enabled" };
  }

  await setProductTypeEnabled(type, enabled);
  revalidatePath("/settings");
  revalidatePath("/orders/new");
  return { ok: true };
}

/** Global admin picks which New Order form(s) staff see: Pro, Lite, or Both. */
export async function updateOrderMode(mode: OrderMode): Promise<Result> {
  const sessionUser = await requireUser();
  if (sessionUser.email !== GLOBAL_ADMIN_EMAIL) {
    return { ok: false, error: "Only the global admin can change the order form mode" };
  }
  if (mode !== "PRO" && mode !== "LITE" && mode !== "BOTH") {
    return { ok: false, error: "Invalid order form mode" };
  }
  await setOrderMode(mode);
  revalidatePath("/settings");
  revalidatePath("/orders/new");
  return { ok: true };
}

/** Admin turns branch management on/off. When off, no branch picker/scoping. */
export async function updateBranchManagement(enabled: boolean): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can change settings" };
  await setBranchManagementEnabled(enabled);
  revalidatePath("/settings");
  revalidatePath("/orders");
  revalidatePath("/orders/new");
  return { ok: true };
}

/**
 * Global admin only: resets EVERYTHING — orders, customers, payments, reminders,
 * timeline, branches, every setting (custom lists, app name, order prefix, toggles)
 * and all other user accounts. Only the global admin (who runs it) is kept, so they
 * stay logged in. A true blank slate — order numbering restarts from 0001 afterwards.
 */
export async function resetAllData(confirmText: string): Promise<Result> {
  const sessionUser = await requireUser();
  // Clearing all data is a global-admin-only operation.
  if (sessionUser.email !== GLOBAL_ADMIN_EMAIL) {
    return { ok: false, error: "Only the global admin can reset all data" };
  }
  if (confirmText.trim().toUpperCase() !== "RESET") {
    return { ok: false, error: 'Type "RESET" to confirm' };
  }

  await prisma.$transaction([
    prisma.orderTimeline.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.reminder.deleteMany(),
    prisma.orderBakeItem.deleteMany(),
    prisma.orderCake.deleteMany(),
    prisma.order.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.setting.deleteMany(),
    // Keep only the admin running this, so they aren't locked out.
    prisma.user.deleteMany({ where: { id: { not: sessionUser.id } } }),
  ]);

  for (const path of ["/orders", "/customers", "/reminders", "/reports", "/settings"]) {
    revalidatePath(path);
  }
  return { ok: true };
}

type PurgeResult = { ok: true; deleted: number } | { ok: false; error: string };

/**
 * Admin cleanup: permanently deletes orders (with their payments, cakes, bake
 * items and timeline) and reminders dated before the retention window, keeping
 * everything within the last `days` days. Customers, branches, settings and users
 * are kept, and order numbering is unaffected. Lifetime customer totals are left
 * as-is on purpose, so they still reflect the customer's real history.
 */
export async function purgeOldData(days: number, confirmText: string): Promise<PurgeResult> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can clear data" };
  if (!(RETENTION_OPTIONS as readonly number[]).includes(days)) {
    return { ok: false, error: "Choose 90, 180, 270 or 365 days" };
  }
  if (confirmText.trim().toUpperCase() !== "DELETE") {
    return { ok: false, error: 'Type "DELETE" to confirm' };
  }

  // Keep anything dated on/after the cutoff (by required/delivery date), so recent
  // and upcoming orders stay; only older ones are removed.
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - days);

  const oldOrders = { requiredDate: { lt: cutoff } };

  // Delete the orders' dependent rows and old reminders first, then the orders
  // themselves (last element — its count is what we report).
  const [, , , , , deletedOrders] = await prisma.$transaction([
    prisma.orderTimeline.deleteMany({ where: { order: oldOrders } }),
    prisma.payment.deleteMany({ where: { order: oldOrders } }),
    prisma.orderBakeItem.deleteMany({ where: { order: oldOrders } }),
    prisma.orderCake.deleteMany({ where: { order: oldOrders } }),
    prisma.reminder.deleteMany({ where: { reminderDate: { lt: cutoff } } }),
    prisma.order.deleteMany({ where: oldOrders }),
  ]);

  for (const path of ["/orders", "/customers", "/reminders", "/reports", "/settings"]) {
    revalidatePath(path);
  }
  return { ok: true, deleted: deletedOrders.count };
}

/**
 * Global-admin-only master lockdown. When enabled, every account except the
 * global admin is locked out of logging in and using the app.
 */
export async function updateMasterLockdown(enabled: boolean): Promise<Result> {
  const sessionUser = await requireUser();
  if (sessionUser.email !== GLOBAL_ADMIN_EMAIL) {
    return { ok: false, error: "Only the global admin can change this" };
  }
  await setMasterLockdown(enabled);
  // Turning lockdown off also cancels any pending auto-lockdown timer.
  if (!enabled) await setAutoLockdownAt(null);
  // Affects auth on every page, so refresh the whole tree.
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Global-admin-only: schedule auto-lockdown N days from now (1–3650). */
export async function scheduleAutoLockdown(days: number): Promise<Result> {
  const sessionUser = await requireUser();
  if (sessionUser.email !== GLOBAL_ADMIN_EMAIL) {
    return { ok: false, error: "Only the global admin can change this" };
  }
  const d = Math.floor(Number(days));
  if (!Number.isFinite(d) || d < 1 || d > 3650) {
    return { ok: false, error: "Enter a number of days between 1 and 3650" };
  }
  const at = new Date(Date.now() + d * 24 * 60 * 60 * 1000);
  await setAutoLockdownAt(at);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Global-admin-only: cancel a pending auto-lockdown timer. */
export async function cancelAutoLockdown(): Promise<Result> {
  const sessionUser = await requireUser();
  if (sessionUser.email !== GLOBAL_ADMIN_EMAIL) {
    return { ok: false, error: "Only the global admin can change this" };
  }
  await setAutoLockdownAt(null);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ── Branch management (admin only) ──────────────────────────────── */

/** Admin creates a new branch. */
export async function createBranch(name: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can manage branches" };
  const n = name.trim();
  if (!n) return { ok: false, error: "Branch name is required" };
  if (n.length > 60) return { ok: false, error: "Branch name must be 60 characters or fewer" };

  const existing = await prisma.branch.findFirst({ where: { name: { equals: n, mode: "insensitive" } } });
  if (existing) return { ok: false, error: "A branch with this name already exists" };

  await prisma.branch.create({ data: { name: n } });
  revalidatePath("/settings");
  return { ok: true };
}

/** Admin renames a branch. */
export async function renameBranch(branchId: string, name: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can manage branches" };
  const n = name.trim();
  if (!n) return { ok: false, error: "Branch name is required" };

  const clash = await prisma.branch.findFirst({
    where: { name: { equals: n, mode: "insensitive" }, id: { not: branchId } },
  });
  if (clash) return { ok: false, error: "A branch with this name already exists" };

  await prisma.branch.update({ where: { id: branchId }, data: { name: n } });
  revalidatePath("/settings");
  return { ok: true };
}

/** Admin deletes a branch. Users and orders under it are detached (branch = none). */
export async function deleteBranch(branchId: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can manage branches" };
  await prisma.branch.delete({ where: { id: branchId } });
  revalidatePath("/settings");
  revalidatePath("/orders");
  return { ok: true };
}

/** Admin assigns a staff user to a branch (or clears it with null). */
export async function setUserBranch(userId: string, branchId: string | null): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can assign branches" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found" };
  // Admins are global — they're never tied to a branch.
  if (target.role === "ADMIN") return { ok: false, error: "Admins are global and can't be assigned a branch" };

  if (branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) return { ok: false, error: "Branch not found" };
  }
  await prisma.user.update({ where: { id: userId }, data: { branchId } });
  revalidatePath("/settings");
  return { ok: true };
}

/**
 * Admin permanently removes a user (staff or another admin) — but never their
 * own account, nor the last remaining admin. Past orders/payments are kept
 * (the creator reference is just cleared).
 */
export async function adminDeleteUser(userId: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can remove users" };
  if (userId === sessionUser.id) return { ok: false, error: "You cannot remove your own account" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.email === GLOBAL_ADMIN_EMAIL) return { ok: false, error: "The global admin can't be removed." };
  // Admins can remove other admins they manage, but never the last one (which
  // would lock everyone out of admin features).
  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) return { ok: false, error: "Can't remove the last admin." };
  }

  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/settings");
  return { ok: true };
}

/** Admin enables/disables a user. A disabled user cannot log in. */
export async function adminToggleUserStatus(userId: string): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can change user status" };
  if (userId === sessionUser.id) return { ok: false, error: "You cannot disable your own account" };

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.email === GLOBAL_ADMIN_EMAIL) return { ok: false, error: "The global admin can't be disabled." };

  await prisma.user.update({
    where: { id: userId },
    data: { status: target.status === "ACTIVE" ? "DISABLED" : "ACTIVE" },
  });
  revalidatePath("/settings");
  return { ok: true };
}

export type UserPermissions = {
  permProcess: boolean;
  permDeliverCancel: boolean;
  permRecordPayment: boolean;
  permDeleteOrder: boolean;
};

/** Admin sets what a user can do on the order screen (the global admin is fixed). */
export async function setUserPermissions(userId: string, perms: UserPermissions): Promise<Result> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can change permissions" };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!target) return { ok: false, error: "User not found" };
  if (target.email === GLOBAL_ADMIN_EMAIL) return { ok: false, error: "The global admin always has full access." };

  await prisma.user.update({
    where: { id: userId },
    data: {
      permProcess: !!perms.permProcess,
      permDeliverCancel: !!perms.permDeliverCancel,
      permRecordPayment: !!perms.permRecordPayment,
      permDeleteOrder: !!perms.permDeleteOrder,
    },
  });
  revalidatePath("/settings");
  return { ok: true };
}

type StaffResult = { ok: true; staff: string[] } | { ok: false; error: string };

/** Admin adds a staff member to the assignable list (Settings → General). */
export async function addStaffMember(name: string): Promise<StaffResult> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can manage staff" };
  const n = name.trim();
  if (!n) return { ok: false, error: "Staff name is required" };
  if (n.length > 40) return { ok: false, error: "Name must be 40 characters or fewer" };

  const staff = await getStaffMembers();
  if (staff.some((s) => s.toLowerCase() === n.toLowerCase())) {
    return { ok: false, error: "That staff member already exists" };
  }
  const updated = [...staff, n];
  await setStaffMembers(updated);
  revalidatePath("/settings");
  return { ok: true, staff: updated };
}

/** Admin removes a staff member from the assignable list. */
export async function removeStaffMember(name: string): Promise<StaffResult> {
  const sessionUser = await requireUser();
  if (!isAdmin(sessionUser)) return { ok: false, error: "Only admins can manage staff" };
  const updated = (await getStaffMembers()).filter((s) => s !== name);
  await setStaffMembers(updated);
  revalidatePath("/settings");
  return { ok: true, staff: updated };
}
