"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** A card whose body collapses behind a clickable header. Collapsed by default. */
export function CollapsibleSection({
  title,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-2xl border border-black/5 bg-card shadow-sm", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-4 text-left"
        aria-expanded={open}
      >
        <h2 className="font-semibold text-brand-dark">{title}</h2>
        <ChevronDown size={18} className={cn("shrink-0 text-foreground/40 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
