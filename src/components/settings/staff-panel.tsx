"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserCog, Plus, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { addStaffMember, removeStaffMember } from "@/app/(app)/settings/actions";

export function StaffPanel({ staff: initial }: { staff: string[] }) {
  const router = useRouter();
  const [staff, setStaff] = useState(initial);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function add(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await addStaffMember(name);
      if (res.ok) {
        setStaff(res.staff);
        setName("");
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  function remove(s: string) {
    start(async () => {
      const res = await removeStaffMember(s);
      if (res.ok) {
        setStaff(res.staff);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold text-brand-dark">
          <UserCog size={18} /> Staff
        </h2>
        <p className="mb-3 text-sm text-foreground/50">
          People you can assign to an order — shown as a dropdown next to Branch on the New Order screen.
        </p>
        <form onSubmit={add} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh" maxLength={40} />
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>
            <Plus size={16} /> {pending ? "Adding…" : "Add staff"}
          </Button>
        </form>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}

        {staff.length > 0 ? (
          <div className="mt-3 flex flex-col gap-2">
            {staff.map((s) => (
              <div key={s} className="flex items-center justify-between rounded-xl border border-black/5 bg-muted/30 p-3">
                <span className="truncate font-medium">{s}</span>
                <Button size="sm" variant="ghost" disabled={pending} onClick={() => remove(s)} aria-label={`Remove ${s}`}>
                  <Trash2 size={15} />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-foreground/40">No staff added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
