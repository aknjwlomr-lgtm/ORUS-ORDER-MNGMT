"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { resetAllData } from "@/app/(app)/settings/actions";

export function DataResetPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function reset() {
    setMsg(null);
    start(async () => {
      const res = await resetAllData(confirm);
      if (res.ok) {
        setMsg({ ok: true, text: "All data has been reset. Order numbering restarts at 0001." });
        setConfirm("");
        setOpen(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card className="border-rose-200">
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-rose-600">
          <AlertTriangle size={18} /> Reset all data
        </h2>
        <p className="mt-2 text-sm text-foreground/60">
          Permanently erases <strong>everything</strong> — all orders, customers, payments,
          reminders, history, branches, every setting, and all other user accounts. Only your
          admin account is kept (so you stay logged in), and order numbering restarts from 0001.
          This cannot be undone.
        </p>

        {!open ? (
          <Button variant="danger" className="mt-4" onClick={() => { setOpen(true); setMsg(null); }}>
            Reset all data…
          </Button>
        ) : (
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-foreground/70">
              Type <span className="font-mono font-semibold text-rose-600">RESET</span> to confirm:
            </label>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" autoFocus />
            <div className="flex gap-2">
              <Button variant="danger" onClick={reset} disabled={pending || confirm.trim().toUpperCase() !== "RESET"}>
                {pending ? "Resetting…" : "Permanently delete all data"}
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
