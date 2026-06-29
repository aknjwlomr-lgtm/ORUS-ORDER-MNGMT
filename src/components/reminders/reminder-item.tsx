"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { REMINDER_PRIORITY_COLOR, REMINDER_STATUS_COLOR } from "@/lib/constants";
import { setReminderStatus } from "@/app/(app)/reminders/actions";

export type ReminderData = {
  id: string;
  title: string;
  reminderType: string;
  reminderDate: string;
  reminderTime: string;
  priority: string;
  status: string;
  notes: string | null;
  customerName: string | null;
  orderNumber: string | null;
};

export function ReminderItem({ r }: { r: ReminderData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const update = (s: string) => start(() => void setReminderStatus(r.id, s).then(() => router.refresh()));

  return (
    <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{r.title}</p>
          <p className="text-xs text-foreground/50">
            {r.reminderType}
            {r.customerName ? ` · ${r.customerName}` : ""}
            {r.orderNumber ? ` · ${r.orderNumber}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={REMINDER_PRIORITY_COLOR[r.priority]}>{r.priority}</Badge>
          <Badge className={REMINDER_STATUS_COLOR[r.status]}>{r.status}</Badge>
        </div>
      </div>
      <p className="mt-2 text-sm text-foreground/60">
        🗓 {formatDate(r.reminderDate)} · {r.reminderTime}
      </p>
      {r.notes && <p className="mt-1 text-sm text-foreground/70">{r.notes}</p>}
      {r.status === "PENDING" && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="success" disabled={pending} onClick={() => update("COMPLETED")}><Check size={15} /> Done</Button>
          <Button size="sm" variant="soft" disabled={pending} onClick={() => update("SNOOZED")}><Clock size={15} /> Snooze</Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => update("MISSED")}><X size={15} /> Missed</Button>
        </div>
      )}
    </div>
  );
}
