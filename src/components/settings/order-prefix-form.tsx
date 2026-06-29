"use client";

import { type FormEvent, useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Fieldset } from "@/components/ui/field";
import { updateOrderPrefix } from "@/app/(app)/settings/actions";

export function OrderPrefixForm({ current }: { current: string }) {
  const [prefix, setPrefix] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateOrderPrefix(prefix);
      setMsg(res.ok ? { ok: true, text: "Order ID prefix updated" } : { ok: false, text: res.error });
    });
  }

  const sample = `${prefix.trim()}0001`;

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-1 font-semibold text-brand-dark">Order ID prefix</h2>
        <p className="mb-3 text-sm text-foreground/50">
          Next order will look like <span className="font-mono text-brand-dark">{sample}</span>
        </p>
        <form onSubmit={onSubmit} className="grid gap-3">
          <Fieldset label="Prefix" hint="Leave blank for no prefix (e.g. 0001)">
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value)} maxLength={20} placeholder="No prefix" />
          </Fieldset>
          {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save prefix"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
