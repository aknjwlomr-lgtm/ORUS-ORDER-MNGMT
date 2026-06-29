"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Fieldset } from "@/components/ui/field";
import { REMINDER_TYPES, REMINDER_PRIORITIES } from "@/lib/constants";
import { createReminder } from "@/app/(app)/reminders/actions";

export function ReminderForm({
  prefill,
}: {
  prefill: { orderId?: string; customerId?: string; title?: string };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({
    title: prefill.title ?? "",
    reminderType: REMINDER_TYPES[0],
    reminderDate: "",
    reminderTime: "10:00",
    priority: "MEDIUM",
    notes: "",
  });
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  function submit() {
    setError(null);
    start(async () => {
      const res = await createReminder({ ...v, orderId: prefill.orderId, customerId: prefill.customerId });
      if (!res.ok) {
        setError(res.error ?? "Failed to save reminder");
        return;
      }
      router.push("/reminders");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-xl px-3 py-4 md:px-6">
      <h1 className="mb-3 text-xl font-bold text-brand-dark">New Reminder</h1>
      <Card>
        <CardContent className="grid gap-4 p-5">
          <Fieldset label="Title" required>
            <Input value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Call about balance payment" />
          </Fieldset>
          <Fieldset label="Reminder type">
            <Select value={v.reminderType} onChange={(e) => set("reminderType", e.target.value)}>
              {REMINDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Fieldset>
          <div className="grid grid-cols-2 gap-3">
            <Fieldset label="Date" required>
              <Input type="date" value={v.reminderDate} onChange={(e) => set("reminderDate", e.target.value)} />
            </Fieldset>
            <Fieldset label="Time" required>
              <Input type="time" value={v.reminderTime} onChange={(e) => set("reminderTime", e.target.value)} />
            </Fieldset>
          </div>
          <Fieldset label="Priority">
            <Select value={v.priority} onChange={(e) => set("priority", e.target.value)}>
              {REMINDER_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Fieldset>
          <Fieldset label="Notes">
            <Textarea value={v.notes} onChange={(e) => set("notes", e.target.value)} />
          </Fieldset>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <Button onClick={submit} disabled={pending} size="lg">{pending ? "Saving…" : "Save reminder"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
