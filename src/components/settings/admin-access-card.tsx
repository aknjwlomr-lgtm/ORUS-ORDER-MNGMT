"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateAdminSectionAccess } from "@/app/(app)/settings/actions";

type Section = "userManagement" | "branchManagement" | "reports" | "customers" | "contact" | "receipt" | "orderStatus";

export function AdminAccessCard({
  userManagement,
  branchManagement,
  reports,
  customers,
  contact,
  receipt,
  orderStatus,
}: {
  userManagement: boolean;
  branchManagement: boolean;
  reports: boolean;
  customers: boolean;
  contact: boolean;
  receipt: boolean;
  orderStatus: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState({ userManagement, branchManagement, reports, customers, contact, receipt, orderStatus });
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(section: Section) {
    const next = !state[section];
    setMsg(null);
    setState((s) => ({ ...s, [section]: next }));
    start(async () => {
      const res = await updateAdminSectionAccess(section, next);
      if (res.ok) router.refresh();
      else {
        setState((s) => ({ ...s, [section]: !next }));
        setMsg(res.error);
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
          <ShieldCheck size={18} /> Admin access
        </h2>
        <p className="mt-1 mb-3 text-sm text-foreground/60">
          Choose which areas the admins you create can see. You (the global admin) always see
          everything. <strong>General is always visible.</strong>
        </p>
        <div className="divide-y divide-black/5">
          <ToggleRow label="User management" enabled={state.userManagement} disabled={pending} onToggle={() => toggle("userManagement")} />
          <ToggleRow label="Branch management" enabled={state.branchManagement} disabled={pending} onToggle={() => toggle("branchManagement")} />
          <ToggleRow label="Reports" enabled={state.reports} disabled={pending} onToggle={() => toggle("reports")} />
          <ToggleRow label="Customers" enabled={state.customers} disabled={pending} onToggle={() => toggle("customers")} />
          <ToggleRow label="Customer contact (Call / WhatsApp)" enabled={state.contact} disabled={pending} onToggle={() => toggle("contact")} />
          <ToggleRow label="Order receipt" enabled={state.receipt} disabled={pending} onToggle={() => toggle("receipt")} />
          <ToggleRow label="Order status & progress" enabled={state.orderStatus} disabled={pending} onToggle={() => toggle("orderStatus")} />
        </div>
        {msg && <p className="mt-3 text-sm text-rose-600">{msg}</p>}
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
