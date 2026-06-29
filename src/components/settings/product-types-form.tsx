"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateProductTypeEnabled } from "@/app/(app)/settings/actions";

export function ProductTypesForm({ cakes, freshBakes }: { cakes: boolean; freshBakes: boolean }) {
  const [state, setState] = useState({ cakes, freshBakes });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function toggle(type: "cakes" | "freshBakes") {
    const next = !state[type];
    setMsg(null);
    start(async () => {
      const res = await updateProductTypeEnabled(type, next);
      if (res.ok) setState((s) => ({ ...s, [type]: next }));
      else setMsg({ ok: false, text: res.error });
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 font-semibold text-brand-dark">Order types</h2>
        <p className="mb-3 text-sm text-foreground/50">
          Choose which product types staff can create orders for. A disabled type is hidden from the
          New Order screen. Existing orders are unaffected.
        </p>
        <div className="divide-y divide-black/5">
          <ToggleRow label="🎂 Cakes" enabled={state.cakes} disabled={pending} onToggle={() => toggle("cakes")} />
          <ToggleRow label="🥐 Fresh Bakes" enabled={state.freshBakes} disabled={pending} onToggle={() => toggle("freshBakes")} />
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  label, enabled, disabled, onToggle,
}: { label: string; enabled: boolean; disabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="font-medium">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50",
          enabled ? "bg-brand" : "bg-black/15"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            enabled ? "left-[22px]" : "left-0.5"
          )}
        />
      </button>
    </div>
  );
}
