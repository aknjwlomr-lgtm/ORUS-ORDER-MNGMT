"use client";

import { type FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, KeyRound, Power, Trash2, Settings2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Fieldset } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";
import {
  adminCreateUser, adminSetUserPassword, adminToggleUserStatus, adminDeleteUser, setUserPermissions,
} from "@/app/(app)/settings/actions";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  permProcess: boolean;
  permDeliverCancel: boolean;
  permRecordPayment: boolean;
  permDeleteOrder: boolean;
};

export function AdminUsersPanel({ users, currentUserId }: { users: AdminUser[]; currentUserId: string }) {
  return (
    <div className="space-y-4">
      <CreateUserCard />
      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 font-semibold text-brand-dark">Users ({users.length})</h2>
          <div className="flex flex-col gap-3">
            {users.map((u) => (
              <UserRow key={u.id} u={u} isSelf={u.id === currentUserId} />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateUserCard() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", email: "", password: "", role: "STAFF" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: string, val: string) => setV((p) => ({ ...p, [k]: val }));

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await adminCreateUser(v);
      if (res.ok) {
        setMsg({ ok: true, text: "User created" });
        setV({ name: "", email: "", password: "", role: "STAFF" });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-brand-dark">
          <UserPlus size={18} /> Create new user
        </h2>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Fieldset label="Name" required>
            <Input value={v.name} onChange={(e) => set("name", e.target.value)} required />
          </Fieldset>
          <Fieldset label="Email" required>
            <Input type="email" autoCapitalize="none" autoCorrect="off" value={v.email} onChange={(e) => set("email", e.target.value)} required />
          </Fieldset>
          <Fieldset label="Temporary password" required hint="At least 6 characters">
            <Input type="text" value={v.password} onChange={(e) => set("password", e.target.value)} required />
          </Fieldset>
          <Fieldset label="Role">
            <Select value={v.role} onChange={(e) => set("role", e.target.value)}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Fieldset>
          {msg && <p className={`text-sm sm:col-span-2 ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create user"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function UserRow({ u, isSelf }: { u: AdminUser; isSelf: boolean }) {
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [permOpen, setPermOpen] = useState(false);
  const [perm, setPerm] = useState({
    permProcess: u.permProcess,
    permDeliverCancel: u.permDeliverCancel,
    permRecordPayment: u.permRecordPayment,
    permDeleteOrder: u.permDeleteOrder,
  });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const isGlobal = u.email === GLOBAL_ADMIN_EMAIL;

  function savePerms() {
    setMsg(null);
    start(async () => {
      const res = await setUserPermissions(u.id, perm);
      if (res.ok) {
        setMsg({ ok: true, text: "Permissions updated" });
        setPermOpen(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  function savePassword() {
    setMsg(null);
    start(async () => {
      const res = await adminSetUserPassword(u.id, pw);
      if (res.ok) {
        setMsg({ ok: true, text: "Password updated" });
        setPw("");
        setPwOpen(false);
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }

  function toggle() {
    setMsg(null);
    start(async () => {
      const res = await adminToggleUserStatus(u.id);
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  function remove() {
    if (!confirm(`Remove ${u.name}? This permanently deletes their account.`)) return;
    setMsg(null);
    start(async () => {
      const res = await adminDeleteUser(u.id);
      if (!res.ok) setMsg({ ok: false, text: res.error });
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-black/5 bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {u.name} {isSelf && <span className="text-xs text-foreground/40">(you)</span>}
          </p>
          <p className="truncate text-sm text-foreground/60">{u.email}</p>
          <p className="text-xs text-foreground/40">Added {formatDate(u.createdAt)}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge className={u.role === "ADMIN" ? "bg-brand/15 text-brand-dark border-brand/20" : "bg-slate-100 text-slate-700 border-slate-200"}>
            {u.role === "ADMIN" ? "Admin" : "Staff"}
          </Badge>
          <Badge className={u.status === "ACTIVE" ? "bg-green-100 text-green-700 border-green-200" : "bg-rose-100 text-rose-700 border-rose-200"}>
            {u.status === "ACTIVE" ? "Active" : "Disabled"}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setPwOpen((o) => !o)}>
          <KeyRound size={15} /> Set password
        </Button>
        {!isSelf && !isGlobal && (
          <Button size="sm" variant={u.status === "ACTIVE" ? "ghost" : "success"} disabled={pending} onClick={toggle}>
            <Power size={15} /> {u.status === "ACTIVE" ? "Disable" : "Enable"}
          </Button>
        )}
        {!isGlobal && (
          <Button size="sm" variant={permOpen ? "primary" : "outline"} onClick={() => setPermOpen((o) => !o)}>
            <Settings2 size={15} /> Settings
          </Button>
        )}
        {!isSelf && !isGlobal && (
          <Button size="sm" variant="danger" disabled={pending} className="ml-auto" onClick={remove}>
            <Trash2 size={15} /> Remove
          </Button>
        )}
      </div>

      {permOpen && !isGlobal && (
        <div className="mt-3 space-y-2 rounded-xl border border-black/10 bg-card p-3">
          <p className="text-xs font-semibold text-foreground/60">What this user can do on an order</p>
          <PermCheck label="Processing actions (Start / Finished processing)" checked={perm.permProcess} onChange={(v) => setPerm((p) => ({ ...p, permProcess: v }))} />
          <PermCheck label="Delivered &amp; Cancelled" checked={perm.permDeliverCancel} onChange={(v) => setPerm((p) => ({ ...p, permDeliverCancel: v }))} />
          <PermCheck label="Record payment" checked={perm.permRecordPayment} onChange={(v) => setPerm((p) => ({ ...p, permRecordPayment: v }))} />
          <PermCheck label="Delete order" checked={perm.permDeleteOrder} onChange={(v) => setPerm((p) => ({ ...p, permDeleteOrder: v }))} />
          <Button size="sm" disabled={pending} onClick={savePerms}>{pending ? "Saving…" : "Save permissions"}</Button>
        </div>
      )}

      {pwOpen && (
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[160px]">
            <Input
              type="text"
              placeholder="New password (min 6 chars)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
          </div>
          <Button size="sm" disabled={pending || pw.length < 6} onClick={savePassword}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
      {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
    </div>
  );
}

function PermCheck({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--brand)]"
      />
      {label}
    </label>
  );
}
