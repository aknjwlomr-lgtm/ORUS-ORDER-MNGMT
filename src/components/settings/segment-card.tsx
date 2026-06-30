"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateAppSegment } from "@/app/(app)/settings/actions";
import type { AppSegment } from "@/lib/settings";

const OPTIONS: { value: AppSegment; label: string; desc: string }[] = [
  { value: "PRO", label: "Pro", desc: "All admin features on · New Order shows both Pro & Lite forms." },
  { value: "LITE", label: "Lite", desc: "Admin features off · New Order shows only the quick Lite form." },
];

export function SegmentCard({ current }: { current: AppSegment }) {
  const router = useRouter();
  const [segment, setSegment] = useState<AppSegment>(current);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function choose(next: AppSegment) {
    if (next === segment || pending) return;
    const prev = segment;
    setSegment(next);
    setMsg(null);
    start(async () => {
      const res = await updateAppSegment(next);
      if (res.ok) router.refresh();
      else {
        setSegment(prev);
        setMsg(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
          <Layers size={18} /> App segment
        </h2>
        <p className="mt-1 mb-3 text-sm text-foreground/60">
          Choose the overall plan. Picking one applies it everywhere — you can still fine-tune
          individual features below afterward.
        </p>
        <div className="space-y-2">
          {OPTIONS.map((o) => {
            const active = segment === o.value;
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
