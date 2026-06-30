"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  PlusCircle, ClipboardList, BarChart3, Bell, Users, LogOut, Settings, Menu, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppName } from "@/components/app-name-context";

type NavUser = { name?: string | null; role: string; showReports?: boolean; showCustomers?: boolean };

const REPORTS = { href: "/reports", label: "Reports", icon: BarChart3 };
const CUSTOMERS = { href: "/customers", label: "Customers", icon: Users };
const SETTINGS = { href: "/settings", label: "Settings", icon: Settings };

// Reports, Customers & Settings are admin-only. Reports/Customers are further
// gated by the global admin (Settings → Admin access) for the admins they create;
// the layout resolves those flags (global admin always true) into showReports /
// showCustomers.
function itemsFor(user: NavUser) {
  const admin = user.role === "ADMIN";
  const reports = admin && user.showReports !== false;
  const customers = admin && user.showCustomers !== false;
  const main = [
    { href: "/orders/new", label: "New Order", icon: PlusCircle },
    { href: "/orders", label: "Orders", icon: ClipboardList },
    ...(reports ? [REPORTS] : []),
    { href: "/reminders", label: "Reminders", icon: Bell },
    ...(customers ? [CUSTOMERS] : []),
  ];
  const all = [...main, ...(admin ? [SETTINGS] : [])];
  // Mobile bottom bar: a focused subset. Reports shows for admins only.
  const bottom = [
    { href: "/orders/new", label: "New Order", icon: PlusCircle },
    { href: "/orders", label: "Orders", icon: ClipboardList },
    { href: "/reminders", label: "Reminders", icon: Bell },
    ...(reports ? [REPORTS] : []),
  ];
  return { main, all, bottom };
}

function isActive(pathname: string, href: string) {
  if (href === "/orders") return pathname === "/orders" || /^\/orders\/(?!new)/.test(pathname);
  return pathname === href || pathname.startsWith(href + "/");
}

async function doSignOut() {
  await signOut({ redirect: false });
  window.location.href = "/login";
}

/* ── Desktop sidebar ─────────────────────────────────────────────── */
export function Sidebar({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const appName = useAppName();
  const { all } = itemsFor(user);
  return (
    <aside className="no-print hidden w-64 shrink-0 flex-col border-r border-black/5 bg-card md:flex">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xl">🎂</div>
        <div>
          <p className="font-bold leading-tight text-brand-dark">{appName}</p>
          <p className="text-xs text-foreground/50">Order Manager</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {all.map((it) => {
          const active = isActive(pathname, it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active ? "bg-brand text-white shadow-sm" : "text-foreground/70 hover:bg-muted"
              )}
            >
              <Icon size={20} />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-black/5 p-3">
        <div className="mb-2 px-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-xs text-foreground/50">{user.role === "ADMIN" ? "Administrator" : "Staff"}</p>
        </div>
        <button
          onClick={doSignOut}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-foreground/70 hover:bg-muted"
        >
          <LogOut size={18} /> Sign out
        </button>
      </div>
    </aside>
  );
}

/* ── Mobile header + collapsible left drawer ─────────────────────── */
export function MobileHeader({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const appName = useAppName();
  const [open, setOpen] = useState(false);
  const { all } = itemsFor(user);

  // auto-close when the route changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // lock body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="no-print fixed inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-black/5 bg-card/90 px-3 py-3 backdrop-blur md:hidden">
        <button
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/70 hover:bg-muted"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-base">🎂</div>
          <p className="text-sm font-bold leading-none text-brand-dark">{appName}</p>
        </div>
      </header>

      {/* Backdrop */}
      <div
        className={cn(
          "no-print fixed inset-0 z-40 bg-black/40 transition-opacity md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        className={cn(
          "no-print fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col bg-card shadow-xl transition-transform md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-xl">🎂</div>
            <div>
              <p className="font-bold leading-tight text-brand-dark">{appName}</p>
              <p className="text-xs text-foreground/50">Order Manager</p>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground/60 hover:bg-muted"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
          {all.map((it) => {
            const active = isActive(pathname, it.href);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                  active ? "bg-brand text-white shadow-sm" : "text-foreground/70 hover:bg-muted"
                )}
              >
                <Icon size={20} />
                {it.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-black/5 p-3">
          <div className="flex items-center justify-between gap-3 px-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs text-foreground/50">{user.role === "ADMIN" ? "Administrator" : "Staff"}</p>
            </div>
            <button
              onClick={doSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white transition hover:bg-rose-600 active:scale-95"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── Mobile bottom nav (primary heads) ───────────────────────────── */
export function BottomNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const { bottom } = itemsFor(user);
  return (
    <nav
      className="no-print pb-safe fixed inset-x-0 bottom-0 z-20 grid border-t border-black/5 bg-card/95 backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${bottom.length}, minmax(0, 1fr))` }}
    >
      {bottom.map((it) => {
        const active = isActive(pathname, it.href);
        const Icon = it.icon;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition",
              active ? "text-brand" : "text-foreground/50"
            )}
          >
            <Icon size={22} className={active ? "scale-110" : ""} />
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
