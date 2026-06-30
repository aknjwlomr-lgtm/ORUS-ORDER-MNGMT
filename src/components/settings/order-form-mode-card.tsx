"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateOrderMode, updateOrderFormFirst } from "@/app/(app)/settings/actions";
import type { OrderMode, OrderFormFirst } from "@/lib/settings";

const MODES: { value: OrderMode; label: string; desc: string }[] = [
  { value: "LITE", label: "Lite only", desc: "Just the quick single-page form." },
  { value: "PRO", label: "Pro only", desc: "Just the full multi-step form." },
  { value: "BOTH", label: "Both", desc: "Two tabs — staff pick one per order." },
];

export function OrderFormModeCard({ mode: initialMode, first: initialFirst }: { mode: OrderMode; first: OrderFormFirst }) {
  const router = useRouter();
  const [mode, setMode] = useState<OrderMode>(initialMode);
  const [first, setFirst] = useState<OrderFormFirst>(initialFirst);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function chooseMode(next: OrderMode) {
    if (next === mode || pending) return;
    const prev = mode;
    setMode(next);
    setMsg(null);
    start(async () => {
      const res = await updateOrderMode(next);
      if (res.ok) router.refresh();
      else { setMode(prev); setMsg(res.error); }
    });
  }

  function chooseFirst(next: OrderFormFirst) {
    if (next === first || pending) return;
    const prev = first;
    setFirst(next);
    setMsg(null);
    start(async () => {
      const res = await updateOrderFormFirst(next);
      if (res.ok) router.refresh();
      else { setFirst(prev); setMsg(res.error); }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
          <ClipboardList size={18} /> New order form
        </h2>
        <p className="mt-1 mb-3 text-sm text-foreground/60">
          Which form staff use on the New Order screen (Pro segment only).
        </p>
        <div className="space-y-2">
          {MODES.map((o) => {
            const active = mode === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={pending}
                onClick={() => chooseMode(o.value)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition disabled:opacity-60",
                  active ? "border-brand bg-brand/5" : "border-black/10 bg-white hover:bg-muted"
                )}
              >
                <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border", active ? "border-brand" : "border-black/25")}>
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

        {mode === "BOTH" && (
          <div className="mt-3 border-t border-black/5 pt-3">
            <p className="mb-2 text-sm font-medium">Show first</p>
            <div className="flex gap-2">
              {(["PRO", "LITE"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={first === f}
                  disabled={pending}
                  onClick={() => chooseFirst(f)}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-sm font-medium transition disabled:opacity-60",
                    first === f ? "border-brand bg-brand text-white" : "border-black/10 bg-white text-foreground/70 hover:bg-muted"
                  )}
                >
                  {f === "PRO" ? "Pro" : "Lite"}
                </button>
              ))}
            </div>
          </div>
        )}

        {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}
      </CardContent>
    </Card>
  );
}
