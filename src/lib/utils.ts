import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Indian Rupees. */
export function inr(amount: number | null | undefined): string {
  const n = Number(amount ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDate(d: Date | string, opts?: Intl.DateTimeFormatOptions): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", opts ?? { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/** Local YYYY-MM-DD key (no timezone shift). */
export function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Human label for a Fresh Bakes quantity + unit, e.g. "12 pcs", "500 g", "2 kg". */
export function bakeQty(
  qty: number | string | null | undefined,
  unit: string | null | undefined
): string {
  const q = Number(qty ?? 0);
  if (unit === "GRAMS") return `${q} g`;
  if (unit === "KG") return `${q} kg`;
  return `${q} pc${q === 1 ? "" : "s"}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
