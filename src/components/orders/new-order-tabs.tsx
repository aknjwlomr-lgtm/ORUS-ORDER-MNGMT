"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Shown when the order mode is "Both": two tabs (Pro / Lite). Only the active
 * form is rendered, so an order is created from exactly one tab — switching tabs
 * starts the other form fresh (no mixing fields across the two).
 */
export function NewOrderTabs({
  pro,
  lite,
  defaultTab = "pro",
}: {
  pro: React.ReactNode;
  lite: React.ReactNode;
  defaultTab?: "pro" | "lite";
}) {
  const [tab, setTab] = useState<"pro" | "lite">(defaultTab);

  return (
    <div>
      <div className="mx-auto flex max-w-3xl gap-2 px-3 pt-4 md:px-6">
        {([["pro", "Pro"], ["lite", "Lite"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-full border px-4 py-2 text-sm font-medium transition",
              tab === key ? "border-brand bg-brand text-white shadow-sm" : "border-black/10 bg-card text-foreground/70 hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "pro" ? pro : lite}
    </div>
  );
}
