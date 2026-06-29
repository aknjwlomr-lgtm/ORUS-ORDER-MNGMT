"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type SettingsSection = {
  key: string;
  label: string;
  icon: ReactNode;
  danger?: boolean;
  content: ReactNode;
};

export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const [active, setActive] = useState(sections[0]?.key);
  const current = sections.find((s) => s.key === active) ?? sections[0];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Left pane (top tabs on mobile) */}
      <nav className="flex gap-1 overflow-x-auto pb-1 md:w-56 md:shrink-0 md:flex-col md:overflow-visible md:pb-0">
        {sections.map((s) => {
          const isActive = s.key === current?.key;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setActive(s.key)}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                isActive
                  ? s.danger
                    ? "bg-rose-50 text-rose-600"
                    : "bg-brand text-white shadow-sm"
                  : cn("hover:bg-muted", s.danger ? "text-rose-600/80" : "text-foreground/70")
              )}
            >
              {s.icon}
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* Content pane */}
      <div className="min-w-0 flex-1">{current?.content}</div>
    </div>
  );
}
