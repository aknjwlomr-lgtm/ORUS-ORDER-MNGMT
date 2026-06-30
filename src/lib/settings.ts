import { cache } from "react";
import { prisma } from "@/lib/prisma";

export const ORDER_PREFIX_KEY = "orderPrefix";
// No prefix by default — order numbers are plain "0001", "0002", … until an
// admin sets a prefix in Settings → General.
export const DEFAULT_ORDER_PREFIX = "";

export const APP_NAME_KEY = "appName";
export const DEFAULT_APP_NAME = "Orus Bakery";

export const MASTER_LOCKDOWN_KEY = "masterLockdown";
export const AUTO_LOCKDOWN_AT_KEY = "autoLockdownAt";
export const BRANCH_MANAGEMENT_KEY = "branchManagement";

/** Whether branches are in use. When off, no branch picker/scoping anywhere. */
export const getBranchManagementEnabled = cache(async (): Promise<boolean> => {
  return (await getSetting(BRANCH_MANAGEMENT_KEY)) === "true";
});

export async function setBranchManagementEnabled(enabled: boolean): Promise<void> {
  await setSetting(BRANCH_MANAGEMENT_KEY, enabled ? "true" : "false");
}

/** The explicit on/off lockdown flag (set by the global admin's toggle). */
export async function getMasterLockdownManual(): Promise<boolean> {
  return (await getSetting(MASTER_LOCKDOWN_KEY)) === "true";
}

export async function setMasterLockdown(enabled: boolean): Promise<void> {
  await setSetting(MASTER_LOCKDOWN_KEY, enabled ? "true" : "false");
}

/** The scheduled auto-lockdown deadline, or null if none is set. */
export async function getAutoLockdownAt(): Promise<Date | null> {
  const raw = await getSetting(AUTO_LOCKDOWN_AT_KEY);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function setAutoLockdownAt(date: Date | null): Promise<void> {
  await setSetting(AUTO_LOCKDOWN_AT_KEY, date ? date.toISOString() : "");
}

/**
 * The effective lockdown state used to gate auth everywhere: the manual flag,
 * OR the auto-lockdown deadline having passed. When the deadline fires, it's
 * converted into a normal manual lockdown (one-shot) and the timer is cleared,
 * so the global admin can later toggle it off as usual.
 */
export const getMasterLockdown = cache(async (): Promise<boolean> => {
  if (await getMasterLockdownManual()) return true;
  const at = await getAutoLockdownAt();
  if (at && Date.now() >= at.getTime()) {
    await setMasterLockdown(true);
    await setAutoLockdownAt(null);
    return true;
  }
  return false;
});

/**
 * The configurable business / app name (default "Orus Bakery"). Shown in the
 * nav, login, receipts, page metadata and customer WhatsApp messages. Cached
 * per request so the several reads on a page hit the DB only once.
 */
export const getAppName = cache(async (): Promise<string> => {
  return (await getSetting(APP_NAME_KEY)) ?? DEFAULT_APP_NAME;
});

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** The configurable order-number prefix, e.g. "ALPHA-ORD-" → ALPHA-ORD-0001. */
export async function getOrderPrefix(): Promise<string> {
  return (await getSetting(ORDER_PREFIX_KEY)) ?? DEFAULT_ORDER_PREFIX;
}

export const CAKES_ENABLED_KEY = "cakesEnabled";
export const FRESH_BAKES_ENABLED_KEY = "freshBakesEnabled";

/**
 * Which product types staff can create orders for. Both default to enabled, so
 * existing installs are unaffected. A disabled type is hidden from the New Order
 * screen (existing orders of that type still display normally).
 */
export async function getProductTypesEnabled(): Promise<{ cakes: boolean; freshBakes: boolean }> {
  const [c, f] = await Promise.all([
    getSetting(CAKES_ENABLED_KEY),
    getSetting(FRESH_BAKES_ENABLED_KEY),
  ]);
  return { cakes: c !== "false", freshBakes: f !== "false" };
}

export async function setProductTypeEnabled(type: "cakes" | "freshBakes", enabled: boolean): Promise<void> {
  await setSetting(type === "cakes" ? CAKES_ENABLED_KEY : FRESH_BAKES_ENABLED_KEY, enabled ? "true" : "false");
}

export const ORDER_MODE_KEY = "orderMode";
export type OrderMode = "PRO" | "LITE" | "BOTH";
export const ORDER_FORM_FIRST_KEY = "orderFormFirst";
export type OrderFormFirst = "PRO" | "LITE";

/**
 * In the Pro segment, which New Order form(s) staff see: the full "Pro" wizard,
 * the quick "Lite" form, or "Both" (two tabs). Defaults to BOTH (matches the Pro
 * segment's "shows both forms"). Ignored in the Lite segment (always Lite).
 */
export async function getOrderMode(): Promise<OrderMode> {
  const v = await getSetting(ORDER_MODE_KEY);
  return v === "LITE" || v === "PRO" ? v : "BOTH";
}

/** When the form mode is "Both", which tab opens first. Default Pro. */
export async function getOrderFormFirst(): Promise<OrderFormFirst> {
  return (await getSetting(ORDER_FORM_FIRST_KEY)) === "LITE" ? "LITE" : "PRO";
}

export async function setOrderFormFirst(first: OrderFormFirst): Promise<void> {
  await setSetting(ORDER_FORM_FIRST_KEY, first);
}

export async function setOrderMode(mode: OrderMode): Promise<void> {
  await setSetting(ORDER_MODE_KEY, mode);
}

export const ADMIN_USER_MGMT_KEY = "adminUserMgmtEnabled";
export const ADMIN_BRANCH_MGMT_KEY = "adminBranchMgmtEnabled";
export const ADMIN_REPORTS_KEY = "adminReportsEnabled";
export const ADMIN_CUSTOMERS_KEY = "adminCustomersEnabled";
export const ADMIN_CONTACT_KEY = "adminContactEnabled";
export const ADMIN_RECEIPT_KEY = "adminReceiptEnabled";
export const ADMIN_ORDER_STATUS_KEY = "adminOrderStatusEnabled";
export type AdminSection = "userManagement" | "branchManagement" | "reports" | "customers" | "contact" | "receipt" | "orderStatus";

const ADMIN_SECTION_KEY: Record<AdminSection, string> = {
  userManagement: ADMIN_USER_MGMT_KEY,
  branchManagement: ADMIN_BRANCH_MGMT_KEY,
  reports: ADMIN_REPORTS_KEY,
  customers: ADMIN_CUSTOMERS_KEY,
  contact: ADMIN_CONTACT_KEY,
  receipt: ADMIN_RECEIPT_KEY,
  orderStatus: ADMIN_ORDER_STATUS_KEY,
};

export type AdminSectionAccess = Record<AdminSection, boolean>;

/**
 * Which areas regular (non-global) users may see. The global admin always sees
 * everything; these flags gate the User-management/Branch-management settings
 * sections, the Reports and Customers nav links, and the customer-contact feature
 * (Call/WhatsApp on cards + the Contact-customer block in an order). Default OFF —
 * the global admin opts each one in. (General is always visible.)
 */
export async function getAdminSectionAccess(): Promise<AdminSectionAccess> {
  const [u, b, r, c, ct, rc, os] = await Promise.all([
    getSetting(ADMIN_USER_MGMT_KEY),
    getSetting(ADMIN_BRANCH_MGMT_KEY),
    getSetting(ADMIN_REPORTS_KEY),
    getSetting(ADMIN_CUSTOMERS_KEY),
    getSetting(ADMIN_CONTACT_KEY),
    getSetting(ADMIN_RECEIPT_KEY),
    getSetting(ADMIN_ORDER_STATUS_KEY),
  ]);
  return {
    userManagement: u === "true",
    branchManagement: b === "true",
    reports: r === "true",
    customers: c === "true",
    contact: ct === "true",
    receipt: rc === "true",
    orderStatus: os === "true",
  };
}

export async function setAdminSectionAccess(section: AdminSection, enabled: boolean): Promise<void> {
  await setSetting(ADMIN_SECTION_KEY[section], enabled ? "true" : "false");
}

/** Turn every admin-access feature on or off at once (used by the Pro/Lite segment preset). */
export async function setAllAdminSectionAccess(enabled: boolean): Promise<void> {
  await Promise.all(
    (Object.keys(ADMIN_SECTION_KEY) as AdminSection[]).map((s) => setAdminSectionAccess(s, enabled))
  );
}

export const APP_SEGMENT_KEY = "appSegment";
export type AppSegment = "PRO" | "LITE";

/**
 * The app's overall plan. PRO enables all admin features and shows both order
 * forms; LITE turns those features off and shows only the quick Lite form.
 * Selecting a segment applies it as a preset (see updateAppSegment); the
 * individual admin-access toggles stay editable afterward. Default PRO.
 */
export async function getAppSegment(): Promise<AppSegment> {
  return (await getSetting(APP_SEGMENT_KEY)) === "LITE" ? "LITE" : "PRO";
}

export async function setAppSegment(segment: AppSegment): Promise<void> {
  await setSetting(APP_SEGMENT_KEY, segment);
}

export const CUSTOM_OCCASIONS_KEY = "customOccasions";

/** Admin/staff-created occasions, stored as a JSON array, shown alongside the built-in ones. */
export async function getCustomOccasions(): Promise<string[]> {
  const raw = await getSetting(CUSTOM_OCCASIONS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function setCustomOccasions(list: string[]): Promise<void> {
  await setSetting(CUSTOM_OCCASIONS_KEY, JSON.stringify(list));
}

export const CUSTOM_FRESH_BAKE_ITEMS_KEY = "customFreshBakeItems";

/** Staff-created Fresh Bakes items, shown alongside the built-in ones. */
export async function getCustomFreshBakeItems(): Promise<string[]> {
  const raw = await getSetting(CUSTOM_FRESH_BAKE_ITEMS_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function setCustomFreshBakeItems(list: string[]): Promise<void> {
  await setSetting(CUSTOM_FRESH_BAKE_ITEMS_KEY, JSON.stringify(list));
}

export const CUSTOM_CAKE_CATEGORIES_KEY = "customCakeCategories";

/** Staff-created cake categories, shown alongside the built-in ones. */
export async function getCustomCakeCategories(): Promise<string[]> {
  const raw = await getSetting(CUSTOM_CAKE_CATEGORIES_KEY);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function setCustomCakeCategories(list: string[]): Promise<void> {
  await setSetting(CUSTOM_CAKE_CATEGORIES_KEY, JSON.stringify(list));
}

/** Read a JSON string-array setting, tolerating missing/corrupt values. */
async function getCustomList(key: string): Promise<string[]> {
  const raw = await getSetting(key);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export const CUSTOM_CAKE_FLAVORS_KEY = "customCakeFlavors";

/** Staff-created cake flavors, shown alongside the built-in ones. */
export async function getCustomCakeFlavors(): Promise<string[]> {
  return getCustomList(CUSTOM_CAKE_FLAVORS_KEY);
}

export async function setCustomCakeFlavors(list: string[]): Promise<void> {
  await setSetting(CUSTOM_CAKE_FLAVORS_KEY, JSON.stringify(list));
}

export const CUSTOM_CAKE_SHAPES_KEY = "customCakeShapes";

/** Staff-created cake shapes, shown alongside the built-in ones. */
export async function getCustomCakeShapes(): Promise<string[]> {
  return getCustomList(CUSTOM_CAKE_SHAPES_KEY);
}

export async function setCustomCakeShapes(list: string[]): Promise<void> {
  await setSetting(CUSTOM_CAKE_SHAPES_KEY, JSON.stringify(list));
}

export const CUSTOM_CAKE_WEIGHTS_KEY = "customCakeWeights";

/** Staff-created cake weights, shown alongside the built-in ones. */
export async function getCustomCakeWeights(): Promise<string[]> {
  return getCustomList(CUSTOM_CAKE_WEIGHTS_KEY);
}

export async function setCustomCakeWeights(list: string[]): Promise<void> {
  await setSetting(CUSTOM_CAKE_WEIGHTS_KEY, JSON.stringify(list));
}

export const STAFF_MEMBERS_KEY = "staffMembers";

/** Bakery staff who can be assigned to an order. Managed in Settings → General. */
export async function getStaffMembers(): Promise<string[]> {
  return getCustomList(STAFF_MEMBERS_KEY);
}

export async function setStaffMembers(list: string[]): Promise<void> {
  await setSetting(STAFF_MEMBERS_KEY, JSON.stringify(list));
}
