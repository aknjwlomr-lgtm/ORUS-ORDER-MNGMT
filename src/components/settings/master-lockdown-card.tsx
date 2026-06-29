"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Timer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { cn, formatDate } from "@/lib/utils";
import {
  updateMasterLockdown, scheduleAutoLockdown, cancelAutoLockdown,
} from "@/app/(app)/settings/actions";

export function MasterLockdownCard({
  enabled: initial,
  autoLockdownAt,
}: {
  enabled: boolean;
  autoLockdownAt: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [days, setDays] = useState("");
  const [pending, start] = useTransition();

  const deadline = autoLockdownAt ? new Date(autoLockdownAt) : null;
  const daysLeft = deadline
    ? Math.max(0, Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : null;

  function toggle() {
    const next = !enabled;
    setMsg(null);
    start(async () => {
      const res = await updateMasterLockdown(next);
      if (res.ok) { setEnabled(next); router.refresh(); }
      else setMsg(res.error);
    });
  }

  function schedule() {
    setMsg(null);
    start(async () => {
      const res = await scheduleAutoLockdown(Number(days));
      if (res.ok) { setDays(""); router.refresh(); }
      else setMsg(res.error);
    });
  }

  function cancel() {
    setMsg(null);
    start(async () => {
      const res = await cancelAutoLockdown();
      if (res.ok) router.refresh();
      else setMsg(res.error);
    });
  }

  return (
    <Card className={cn(enabled && "border-rose-300")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
              <Lock size={18} /> Master lockdown
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              When on, <strong>every account except the global admin is locked out</strong> — no one
              else can sign in or use the app until you turn it off.
            </p>
            <p className="mt-1 text-sm font-medium">
              Status:{" "}
              <span className={enabled ? "text-rose-600" : "text-emerald-600"}>
                {enabled ? "Locked — only you can sign in" : "Off — everyone can sign in"}
              </span>
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={pending}
            onClick={toggle}
            className={cn(
              "relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-50",
              enabled ? "bg-rose-500" : "bg-black/15"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 transform rounded-full bg-white shadow transition",
                enabled ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Auto-lockdown timer */}
        <div className="mt-4 border-t border-black/5 pt-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-brand-dark">
            <Timer size={16} /> Auto-lockdown
          </h3>
          {deadline ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-foreground/70">
                Locks automatically on <span className="font-medium text-foreground">{formatDate(deadline)}</span>
                {" — "}
                <span className="font-semibold text-rose-600">{daysLeft} day{daysLeft === 1 ? "" : "s"} left</span>
              </p>
              <Button size="sm" variant="outline" disabled={pending} onClick={cancel}>Cancel timer</Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-foreground/60">
                Start a countdown — the system locks down automatically when it ends.
              </p>
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={days}
                  onChange={(e) => setDays(e.target.value)}
                  placeholder="e.g. 365"
                  className="w-32"
                />
                <span className="pb-2.5 text-sm text-foreground/60">days</span>
                <Button size="sm" disabled={pending || !days || Number(days) < 1} onClick={schedule}>
                  Start countdown
                </Button>
              </div>
            </>
          )}
        </div>

        {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
      </CardContent>
    </Card>
  );
}
