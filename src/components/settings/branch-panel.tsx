"use client";

import { type FormEvent, type ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Plus, Trash2, Check, X, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import {
  createBranch, renameBranch, deleteBranch, setUserBranch, updateBranchManagement,
} from "@/app/(app)/settings/actions";
import { GLOBAL_ADMIN_EMAIL } from "@/lib/constants";

export type BranchRow = { id: string; name: string; userCount: number };
export type BranchUser = { id: string; name: string; email: string; role: string; branchId: string | null };

export function BranchPanel({
  enabled,
  branches,
  users,
}: {
  enabled: boolean;
  branches: BranchRow[];
  users: BranchUser[];
}) {
  const admins = users.filter((u) => u.role === "ADMIN");
  const staff = users.filter((u) => u.role !== "ADMIN");
  const branchIds = new Set(branches.map((b) => b.id));
  const unassignedStaff = staff.filter((u) => !u.branchId || !branchIds.has(u.branchId));

  return (
    <div className="space-y-4">
      <EnableBranchCard enabled={enabled} />

      {!enabled ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-card/50 p-6 text-center text-sm text-foreground/50">
          Turn on branch management above to add branches and assign users.
        </p>
      ) : (
        <>
      <CreateBranchCard />

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-brand-dark">
            <Building2 size={18} /> Branches ({branches.length})
          </h2>
          {branches.length === 0 ? (
            <p className="text-sm text-foreground/50">No branches yet. Add one above.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {branches.map((b) => <BranchRowItem key={b.id} branch={b} />)}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="mb-1 font-semibold text-brand-dark">Assign users to branches</h2>
          <p className="mb-3 text-xs text-foreground/50">
            A staff member sees and places orders for their assigned branch. Admins are global (all branches).
          </p>

          {/* Admins */}
          <GroupHeading>Admins</GroupHeading>
          <div className="flex flex-col gap-2">
            {admins.map((u) => <UserBranchRow key={u.id} user={u} branches={branches} />)}
          </div>

          {/* Staff grouped by branch */}
          <GroupHeading className="mt-5">Staff</GroupHeading>
          <div className="space-y-4">
            {branches.map((b) => {
              const members = staff.filter((u) => u.branchId === b.id);
              return (
                <div key={b.id}>
                  <p className="mb-1.5 text-sm font-semibold text-brand-dark">{b.name}</p>
                  {members.length === 0 ? (
                    <p className="text-xs text-foreground/40">No staff assigned</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {members.map((u) => <UserBranchRow key={u.id} user={u} branches={branches} />)}
                    </div>
                  )}
                </div>
              );
            })}

            {unassignedStaff.length > 0 && (
              <div>
                <p className="mb-1.5 text-sm font-semibold text-foreground/50">Unassigned</p>
                <div className="flex flex-col gap-2">
                  {unassignedStaff.map((u) => <UserBranchRow key={u.id} user={u} branches={branches} />)}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
        </>
      )}
    </div>
  );
}

function EnableBranchCard({ enabled: initial }: { enabled: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !enabled;
    setMsg(null);
    start(async () => {
      const res = await updateBranchManagement(next);
      if (res.ok) { setEnabled(next); router.refresh(); }
      else setMsg(res.error);
    });
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 font-semibold text-brand-dark">
              <Building2 size={18} /> Branch management
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Run multiple branches: assign staff to a branch and tag every order with its branch.
              When off, orders aren&apos;t tied to any branch and the branch picker is hidden.
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
              enabled ? "bg-brand" : "bg-black/15"
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
        {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
      </CardContent>
    </Card>
  );
}

function GroupHeading({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/40 ${className}`}>
      {children}
    </h3>
  );
}

function CreateBranchCard() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await createBranch(name);
      if (res.ok) {
        setMsg({ ok: true, text: "Branch created" });
        setName("");
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
          <Plus size={18} /> Add branch
        </h2>
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. MG Road" maxLength={60} required />
          </div>
          <Button type="submit" disabled={pending || !name.trim()}>{pending ? "Adding…" : "Add branch"}</Button>
        </form>
        {msg && <p className={`mt-2 text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.text}</p>}
      </CardContent>
    </Card>
  );
}

function BranchRowItem({ branch }: { branch: BranchRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(branch.name);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setMsg(null);
    start(async () => {
      const res = await renameBranch(branch.id, name);
      if (res.ok) { setEditing(false); router.refresh(); }
      else setMsg(res.error);
    });
  }

  function remove() {
    if (!confirm(`Delete branch "${branch.name}"? Its users and orders will become unassigned.`)) return;
    start(async () => {
      const res = await deleteBranch(branch.id);
      if (res.ok) router.refresh();
      else setMsg(res.error);
    });
  }

  return (
    <div className="rounded-xl border border-black/5 bg-muted/30 p-3">
      <div className="flex items-center gap-2">
        {editing ? (
          <>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="flex-1" autoFocus />
            <Button size="sm" disabled={pending || !name.trim()} onClick={save}><Check size={15} /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(branch.name); }}><X size={15} /></Button>
          </>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{branch.name}</p>
              <p className="text-xs text-foreground/40">{branch.userCount} user{branch.userCount === 1 ? "" : "s"}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil size={15} /></Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={remove}><Trash2 size={15} /></Button>
          </>
        )}
      </div>
      {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
    </div>
  );
}

function UserBranchRow({ user, branches }: { user: BranchUser; branches: BranchRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [branchId, setBranchId] = useState(user.branchId ?? "");

  function change(value: string) {
    setBranchId(value);
    start(async () => {
      await setUserBranch(user.id, value || null);
      router.refresh();
    });
  }

  // Admins are global — they're never tied to a branch, so there's nothing to assign.
  if (user.role === "ADMIN") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-muted/30 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{user.name}</p>
          <p className="text-xs text-foreground/40">
            {user.email === GLOBAL_ADMIN_EMAIL ? "Admin · global" : "Admin"}
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-brand/20 bg-brand/10 px-3 py-1.5 text-xs font-medium text-brand-dark">
          All branches
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/5 bg-muted/30 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{user.name}</p>
        <p className="text-xs text-foreground/40">Staff</p>
      </div>
      <div className="w-40 shrink-0">
        <Select value={branchId} onChange={(e) => change(e.target.value)} disabled={pending}>
          {!branchId && <option value="" disabled>Select branch…</option>}
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </div>
    </div>
  );
}
