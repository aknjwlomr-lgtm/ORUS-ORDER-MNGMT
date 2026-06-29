"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Fieldset } from "@/components/ui/field";
import { updateAppName } from "@/app/(app)/settings/actions";

export function AppNameForm({ current }: { current: string }) {
  const [name, setName] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateAppName(name);
      setMsg(res.ok ? { ok: true, text: "App name updated" } : { ok: false, text: res.error });
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 font-semibold text-brand-dark">App name</h2>
        <p className="mb-3 text-sm text-foreground/50">
          Shown across the app — navigation, login, receipts, page titles and customer WhatsApp messages.
        </p>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Fieldset label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required />
          </Fieldset>
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save name"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
