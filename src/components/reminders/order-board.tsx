"use client";

import { useState } from "react";
import { OrderCard, type OrderCardData } from "@/components/orders/order-card";
import { cn } from "@/lib/utils";

export type BoardSection = {
  key: string;
  label: string;
  items: OrderCardData[];
  empty: string;
  /** Draws the tab in a warning colour (used for Overdue). */
  danger?: boolean;
};

/**
 * The orders reminder board. Each date group (Overdue / Today / …) is a tab; only
 * the selected group's order cards are shown. All groups arrive pre-bucketed from
 * the server, so switching tabs is instant (no refetch).
 */
export function OrderBoard({
  sections,
  canEdit,
  initialKey = "today",
}: {
  sections: BoardSection[];
  canEdit: boolean;
  initialKey?: string;
}) {
  const [active, setActive] = useState(initialKey);
  const current = sections.find((s) => s.key === active) ?? sections[0];

  return (
    <div>
      <nav className="-mx-3 mb-4 flex gap-1 overflow-x-auto px-3 pb-1 md:mx-0 md:px-0">
        {sections.map((s) => {
          const isActive = s.key === current.key;
          const alert = s.danger && s.items.length > 0;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={cn(
                "shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition",
                isActive
                  ? alert
                    ? "bg-rose-500 text-white shadow-sm"
                    : "bg-brand text-white shadow-sm"
                  : cn("hover:bg-muted", alert ? "text-rose-600" : "text-foreground/60")
              )}
            >
              {s.label} ({s.items.length})
            </button>
          );
        })}
      </nav>

      {current.items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-foreground/40">
          {current.empty}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {current.items.map((o) => <OrderCard key={o.id} o={o} canEdit={canEdit} />)}
        </div>
      )}
    </div>
  );
}
