"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ChevronDown, Plus, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addCustomOccasion, removeCustomOccasion } from "@/app/(app)/orders/actions";

export function OccasionPicker({
  value,
  onChange,
  base,
  custom: initialCustom,
}: {
  value: string;
  onChange: (val: string) => void;
  base: readonly string[];
  custom: string[];
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState<string[]>(initialCustom);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
        setError(null);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function addCustom() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    start(async () => {
      const res = await addCustomOccasion(name);
      if (res.ok) {
        setCustom(res.occasions);
        onChange(name);
        setNewName("");
        setAdding(false);
        setOpen(false);
      } else {
        setError(res.error);
      }
    });
  }

  function removeCustom(name: string) {
    start(async () => {
      const res = await removeCustomOccasion(name);
      if (res.ok) {
        setCustom(res.occasions);
        if (value === name) onChange(base[0] ?? "");
      }
    });
  }

  function pick(name: string) {
    onChange(name);
    setOpen(false);
    setAdding(false);
    setError(null);
  }

  const options = [
    ...base.map((o) => ({ name: o, removable: false })),
    ...custom.map((o) => ({ name: o, removable: true })),
  ];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl border border-black/10 bg-white px-3 py-2.5 text-left text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
      >
        <span className={cn(!value && "text-foreground/30")}>{value || "Select occasion"}</span>
        <ChevronDown size={16} className={cn("shrink-0 text-foreground/40 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-black/10 bg-card shadow-lg">
          <ul className="max-h-60 overflow-y-auto py-1">
            {options.map((o) => (
              <li key={o.name} className="flex items-center">
                <button
                  type="button"
                  onClick={() => pick(o.name)}
                  className={cn(
                    "flex flex-1 items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                    value === o.name && "font-medium text-brand-dark"
                  )}
                >
                  {value === o.name ? <Check size={15} className="text-brand" /> : <span className="w-[15px]" />}
                  {o.name}
                </button>
                {o.removable && (
                  <button
                    type="button"
                    onClick={() => removeCustom(o.name)}
                    disabled={pending}
                    className="mr-1.5 flex h-7 w-7 items-center justify-center rounded-lg text-foreground/40 hover:bg-rose-50 hover:text-rose-600"
                    aria-label={`Delete ${o.name}`}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-black/5 p-1.5">
            {!adding ? (
              <button
                type="button"
                onClick={() => { setAdding(true); setError(null); }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-brand-dark hover:bg-muted"
              >
                <Plus size={15} /> Create custom
              </button>
            ) : (
              <div className="flex items-center gap-1.5 p-1">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                  placeholder="New occasion"
                  autoFocus
                  maxLength={40}
                  className="w-full rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={addCustom}
                  disabled={pending || !newName.trim()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white disabled:opacity-50"
                  aria-label="Add occasion"
                >
                  <Check size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => { setAdding(false); setNewName(""); setError(null); }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/50 hover:bg-muted"
                  aria-label="Cancel"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {error && <p className="px-2.5 pb-1 text-xs text-rose-600">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
