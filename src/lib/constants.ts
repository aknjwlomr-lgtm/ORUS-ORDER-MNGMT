// Shared option lists, labels and status colours for Alpha Bakery.

// The fixed "super" admin account. Its name/email can't be changed and it can
// never be disabled or removed — the permanent fallback administrator.
export const GLOBAL_ADMIN_EMAIL = "global@admin.in";
export const GLOBAL_ADMIN_NAME = "Global admin";

export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "INGREDIENTS_READY",
  "BAKING",
  "DECORATION",
  "PACKED",
  "READY",
  "OUT_FOR_DELIVERY",
  "PAYMENT_CLOSED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatusKey = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<string, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  INGREDIENTS_READY: "Ingredients Ready",
  BAKING: "Baking",
  DECORATION: "Decoration",
  PACKED: "Packed",
  READY: "Ready",
  OUT_FOR_DELIVERY: "Out for Delivery",
  PAYMENT_CLOSED: "Payment Closed",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

/**
 * The simplified, staff-facing order journey shown as a progress bar on each
 * order. Every stage maps to an OrderStatus stored in the DB; older/granular
 * statuses are folded into the right stage by orderStageIndex(). "Cancelled" is a
 * separate terminal state and isn't part of the linear bar.
 */
export const ORDER_STAGES = [
  { key: "CONFIRMED", label: "Order Confirmed", short: "Confirmed" },
  { key: "BAKING", label: "Processing", short: "Processing" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery", short: "Out" },
  { key: "PAYMENT_CLOSED", label: "Payment Closed", short: "Payment" },
  { key: "DELIVERED", label: "Delivered", short: "Delivered" },
] as const;

/** Which progress stage (0-based) a stored order status falls under. */
export function orderStageIndex(status: string): number {
  switch (status) {
    case "OUT_FOR_DELIVERY": return 2;
    case "PAYMENT_CLOSED": return 3;
    case "DELIVERED": return 4;
    case "INGREDIENTS_READY":
    case "BAKING":
    case "DECORATION":
    case "PACKED":
    case "READY":
      return 1;
    // NEW, CONFIRMED (and anything unexpected) start at "Order Confirmed".
    default: return 0;
  }
}

/**
 * Which stage the progress bar should *display*, with the outstanding balance
 * gating the Payment stage:
 *  - balance still due  → the bar can't move past "Out for Delivery".
 *  - balance cleared    → once the order has reached "Out", it advances to
 *                         "Payment" (and can go on to "Delivered").
 */
export function displayStageIndex(status: string, balance: number): number {
  const raw = orderStageIndex(status);
  // An order explicitly marked Delivered always shows Delivered, even if a
  // balance is still pending (staff chose to settle later).
  if (raw >= 4) return 4;
  if (balance > 0) return Math.min(raw, 2);
  if (raw >= 2) return Math.max(raw, 3);
  return raw;
}

/**
 * Whether a progress stage (by index) is reached/filled. The Payment stage
 * (index 3) is tied to the balance — once it's cleared (balance 0) Payment shows
 * as done regardless of where the order is in processing. The others follow the
 * processing status.
 */
export function isStageReached(stageIndex: number, status: string, balance: number): boolean {
  const raw = orderStageIndex(status);
  // Payment is done only when the balance is cleared — never just because the
  // order moved on (e.g. marked Delivered with the payment settled later).
  if (stageIndex === 3) return balance <= 0;
  return raw >= stageIndex;
}

// Tailwind classes for status chips / calendar dots
export const ORDER_STATUS_COLOR: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700 border-slate-200",
  CONFIRMED: "bg-blue-100 text-blue-700 border-blue-200",
  INGREDIENTS_READY: "bg-cyan-100 text-cyan-700 border-cyan-200",
  BAKING: "bg-amber-100 text-amber-700 border-amber-200",
  DECORATION: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  PACKED: "bg-indigo-100 text-indigo-700 border-indigo-200",
  READY: "bg-emerald-100 text-emerald-700 border-emerald-200",
  OUT_FOR_DELIVERY: "bg-teal-100 text-teal-700 border-teal-200",
  PAYMENT_CLOSED: "bg-violet-100 text-violet-700 border-violet-200",
  DELIVERED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

export const ORDER_STATUS_DOT: Record<string, string> = {
  NEW: "bg-slate-400",
  CONFIRMED: "bg-blue-500",
  INGREDIENTS_READY: "bg-cyan-500",
  BAKING: "bg-amber-500",
  DECORATION: "bg-fuchsia-500",
  PACKED: "bg-indigo-500",
  READY: "bg-emerald-500",
  OUT_FOR_DELIVERY: "bg-teal-500",
  PAYMENT_CLOSED: "bg-violet-500",
  DELIVERED: "bg-green-600",
  CANCELLED: "bg-rose-500",
};

export const PAYMENT_STATUSES = ["NOT_PAID", "ADVANCE_PAID", "FULLY_PAID", "REFUNDED"] as const;
export const PAYMENT_STATUS_LABEL: Record<string, string> = {
  NOT_PAID: "Not Paid",
  ADVANCE_PAID: "Advance Paid",
  FULLY_PAID: "Fully Paid",
  REFUNDED: "Refunded",
};
export const PAYMENT_STATUS_COLOR: Record<string, string> = {
  NOT_PAID: "bg-rose-100 text-rose-700 border-rose-200",
  ADVANCE_PAID: "bg-amber-100 text-amber-700 border-amber-200",
  FULLY_PAID: "bg-green-100 text-green-700 border-green-200",
  REFUNDED: "bg-slate-100 text-slate-700 border-slate-200",
};

export const PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
export const PAYMENT_MODE_LABEL: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};

export const DELIVERY_TYPES = ["PICKUP", "HOME_DELIVERY"] as const;
export const DELIVERY_TYPE_LABEL: Record<string, string> = {
  PICKUP: "Pickup",
  HOME_DELIVERY: "Home Delivery",
};

export const PRIORITIES = ["NORMAL", "URGENT", "HIGH", "CRITICAL"] as const;
export const PRIORITY_LABEL: Record<string, string> = {
  NORMAL: "Normal",
  URGENT: "Urgent",
  HIGH: "High Priority",
  CRITICAL: "Critical",
};

export const CUSTOMER_TYPES = ["NEW", "EXISTING", "REGULAR"] as const;
export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  NEW: "New Customer",
  EXISTING: "Existing Customer",
  REGULAR: "Regular Customer",
};

export const OCCASIONS = [
  "Birthday",
  "Wedding",
  "Anniversary",
  "Engagement",
  "Holy Communion",
];

export const CAKE_CATEGORIES = [
  "Birthday Cake",
  "Wedding Cake",
  "Anniversary Cake",
  "Custom Cake",
];

export const CAKE_FLAVORS = [
  "Red Velvet",
  "Black Forest",
  "White Forest",
];

// Fresh Bakes — bakery items (non-cake). Staff can add/remove their own on top
// of these built-ins, stored the same way as custom occasions.
export const FRESH_BAKE_ITEMS = [
  "Egg Puffs",
];

export const CAKE_SHAPES = ["Round", "Square", "Heart", "Rectangle", "Custom Shape"];

export const CAKE_WEIGHTS = ["500g", "1kg", "1.5kg", "2kg", "3kg"];

export const PREP_STATUSES = [
  "Pending",
  "Ingredients Ready",
  "Baking",
  "Cooling",
  "Decoration",
  "Packing",
  "Ready",
  "Delivered",
];

export const REMINDER_TYPES = [
  "Order Confirmation",
  "Advance Payment Follow-up",
  "Balance Payment Follow-up",
  "Cake Preparation Start",
  "Decoration Start",
  "Delivery Time",
  "Customer Pickup",
  "Birthday Follow-up",
  "Anniversary Follow-up",
  "Pending Payment",
  "Custom Reminder",
];

export const REMINDER_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export const REMINDER_STATUSES = ["PENDING", "COMPLETED", "MISSED", "SNOOZED"] as const;
export const REMINDER_STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 border-amber-200",
  COMPLETED: "bg-green-100 text-green-700 border-green-200",
  MISSED: "bg-rose-100 text-rose-700 border-rose-200",
  SNOOZED: "bg-slate-100 text-slate-700 border-slate-200",
};

export const REMINDER_PRIORITY_COLOR: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700 border-slate-200",
  MEDIUM: "bg-blue-100 text-blue-700 border-blue-200",
  HIGH: "bg-amber-100 text-amber-700 border-amber-200",
  URGENT: "bg-rose-100 text-rose-700 border-rose-200",
};
