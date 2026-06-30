"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { RETENTION_OPTIONS } from "@/lib/constants";
import { purgeOldData } from "@/app/(app)/settings/actions";

export function DataRetentionPanel() {
  const router = useRouter();
  const [days, setDays] = useState<number>(180);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function run() {
    setMsg(null);
    start(async () => {
      const res = await purgeOldData(days, confirm);
      if (res.ok) {
        setMsg({ ok: true, text: `Cleared data older than ${days} days — ${res.deleted} order${res.deleted === 1 ? "" : "s"} removed.` });
        setConfirm("");
        setOpen(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card className="border-amber-200">
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-amber-700">
          <Trash2 size={18} /> Clear old data
        </h2>
        <p className="mt-2 text-sm text-foreground/60">
          Permanently deletes orders, payments, history and reminders older than the
          selected period, keeping everything within it. Customers, branches, settings
          and users are kept, and order numbering is unaffected. This cannot be undone.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-foreground/70">Keep the last</span>
          <Select
            value={days}
            onChange={(e) => { setDays(Number(e.target.value)); setOpen(false); setMsg(null); }}
            className="w-auto normal-case"
            disabled={pending}
          >
            {RETENTION_OPTIONS.map((d) => (
              <option key={d} value={d}>{d} days</option>
            ))}
          </Select>
        </div>

        {!open ? (
          <Button variant="danger" className="mt-4" onClick={() => { setOpen(true); setMsg(null); }}>
            Clear data older than {days} days…
          </Button>
        ) : (
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-foreground/70">
              Type <span className="font-mono font-semibold text-rose-600">DELETE</span> to confirm clearing everything older than {days} days:
            </label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" autoFocus />
            <div className="flex gap-2">
              <Button variant="danger" onClick={run} disabled={pending || confirm.trim().toUpperCase() !== "DELETE"}>
                {pending ? "Clearing…" : `Delete data older than ${days} days`}
              </Button>
              <Button variant="outline" onClick={() => { setOpen(false); setConfirm(""); setMsg(null); }} disabled={pending}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}
