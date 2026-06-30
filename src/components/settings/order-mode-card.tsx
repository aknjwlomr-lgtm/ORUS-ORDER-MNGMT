"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateOrderMode } from "@/app/(app)/settings/actions";
import type { OrderMode } from "@/lib/settings";

const OPTIONS: { value: OrderMode; label: string; desc: string }[] = [
  { value: "PRO", label: "Pro only", desc: "The full multi-step order form." },
  { value: "LITE", label: "Lite only", desc: "A quick single-page form with the basics." },
  { value: "BOTH", label: "Both", desc: "Show Pro and Lite as tabs — staff pick one per order." },
];

export function OrderModeCard({ current }: { current: OrderMode }) {
  const router = useRouter();
  const [mode, setMode] = useState<OrderMode>(current);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(next: OrderMode) {
    if (next === mode || pending) return;
    const prev = mode;
    setMode(next);
    setMsg(null);
    start(async () => {
      const res = await updateOrderMode(next);
      if (res.ok) router.refresh();
      else {
        setMode(prev);
        setMsg(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
          <LayoutTemplate size={18} /> New order form
        </h2>
        <p className="mt-1 mb-3 text-sm text-foreground/60">
          Choose which order form staff use on the New Order screen.
        </p>
        <div className="space-y-2">
          {OPTIONS.map((o) => {
            const active = mode === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={pending}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60",
                  active ? "border-brand bg-brand/5" : "border-black/10 bg-white hover:bg-muted"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                    active ? "border-brand" : "border-black/25"
                  )}
                >
                  {active && <span className="h-2.5 w-2.5 rounded-full bg-brand" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-foreground/55">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}
      </CardContent>
    </Card>
  );
}
