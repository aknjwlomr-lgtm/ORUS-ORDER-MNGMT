"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Sub-tabs inside "User management": "User" (everyone) and "Global" (global
 * admin only). Contents are passed in so they can be server-rendered.
 */
export function UserManagementTabs({
  userContent,
  globalContent,
  showGlobal,
}: {
  userContent: ReactNode;
  globalContent: ReactNode;
  showGlobal: boolean;
}) {
  const [tab, setTab] = useState<"user" | "global">("user");
  const active = tab === "global" && showGlobal ? "global" : "user";

  const tabs: { key: "user" | "global"; label: string }[] = [
    { key: "user", label: "User" },
    ...(showGlobal ? [{ key: "global" as const, label: "Global" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition",
              active === t.key
                ? "border-brand bg-brand text-white"
                : "border-black/10 bg-card text-foreground/70 hover:bg-muted"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "user" ? userContent : globalContent}
    </div>
  );
}
