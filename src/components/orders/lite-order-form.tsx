"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Fieldset } from "@/components/ui/field";
import { cn, inr } from "@/lib/utils";
import { CAKE_FLAVORS, FRESH_BAKE_ITEMS, CUSTOMER_TYPE_LABEL } from "@/lib/constants";
import {
  createOrder, lookupCustomer, searchCustomers, addCakeFlavor, removeCakeFlavor,
} from "@/app/(app)/orders/actions";
import { AttributePicker } from "@/components/orders/attribute-picker";
import { BakeItemPicker } from "@/components/orders/bake-item-picker";

type CustomerSuggestion = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  customerType: string;
  totalOrders: number;
};

type MeasureUnit = "PIECE" | "GRAMS" | "KG";
type CakeLine = { flavor: string; qty: string; unit: MeasureUnit; message: string; instructions: string; price: string };
type ItemLine = { name: string; qty: string; unit: MeasureUnit; notes: string; price: string };

const cakeLine = (): CakeLine => ({ flavor: "", qty: "", unit: "PIECE", message: "", instructions: "", price: "" });
const itemLine = (): ItemLine => ({ name: "", qty: "", unit: "PIECE", notes: "", price: "" });

// A cake's weight column stores piece/weight as a compact string ("12 pcs",
// "1.5kg", "500g"), matching how the Pro form encodes it.
function measureToCakeWeight(qty: string, unit: MeasureUnit): string {
  if (!qty) return "";
  if (unit === "PIECE") return `${qty} pcs`;
  return `${qty}${unit === "GRAMS" ? "g" : "kg"}`;
}

export function LiteOrderForm({
  defaultDate,
  branches = [],
  pickBranch = false,
  staffMembers = [],
  customerDirectory = [],
  cakesEnabled = true,
  freshBakesEnabled = true,
  customCakeFlavors = [],
  customBakeItems = [],
}: {
  defaultDate?: string;
  branches?: { id: string; name: string }[];
  pickBranch?: boolean;
  staffMembers?: string[];
  customerDirectory?: CustomerSuggestion[];
  cakesEnabled?: boolean;
  freshBakesEnabled?: boolean;
  customCakeFlavors?: string[];
  customBakeItems?: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const whatsappTouched = useRef(false);
  const [branchId, setBranchId] = useState("");
  const [assignedStaff, setAssignedStaff] = useState("");
  const [requiredDate, setRequiredDate] = useState(defaultDate || "");
  const [requiredTime, setRequiredTime] = useState("");

  const [productType, setProductType] = useState<"CAKE" | "FRESH_BAKES">(cakesEnabled ? "CAKE" : "FRESH_BAKES");
  const [cakes, setCakes] = useState<CakeLine[]>([cakeLine()]);
  const [items, setItems] = useState<ItemLine[]>([itemLine()]);
  const [advancePaid, setAdvancePaid] = useState("");

  // Shared custom-option lists (so an added flavour/item sticks for this session).
  const [flavors, setFlavors] = useState<string[]>(customCakeFlavors);
  const [bakeNames, setBakeNames] = useState<string[]>(customBakeItems);

  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  // Cake / item line helpers.
  const patchCake = (i: number, patch: Partial<CakeLine>) => setCakes((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const patchItem = (i: number, patch: Partial<ItemLine>) => setItems((p) => p.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeCake = (i: number) => setCakes((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const removeItem = (i: number) => setItems((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));

  // A line counts once it has a price (items also need a name). The order's type
  // is derived from what's included — same rule the Pro form uses.
  const includedCakes = useMemo(() => cakes.filter((c) => Number(c.price || 0) > 0), [cakes]);
  const includedItems = useMemo(() => items.filter((it) => it.name.trim() !== "" && Number(it.price || 0) > 0), [items]);
  const total = useMemo(
    () => [...includedCakes, ...includedItems].reduce((s, l) => s + Number(l.price || 0), 0),
    [includedCakes, includedItems]
  );
  const balance = Math.max(0, total - Number(advancePaid || 0));

  function onPhoneChange(value: string) {
    setPhone(value);
    if (!whatsappTouched.current) setWhatsapp(value);
    const q = value.trim().toLowerCase();
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    if (q.length < 2) {
      searchSeq.current++;
      setSuggestions([]);
      return;
    }
    if (customerDirectory.length > 0) {
      searchSeq.current++;
      setSuggestions(
        customerDirectory
          .filter((c) =>
            c.phone.toLowerCase().includes(q) ||
            (c.whatsapp ?? "").toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q)
          )
          .slice(0, 6)
      );
      return;
    }
    const seq = ++searchSeq.current;
    phoneTimer.current = setTimeout(async () => {
      const results = await searchCustomers(q);
      if (seq === searchSeq.current) setSuggestions(results);
    }, 250);
  }

  async function selectSuggestion(s: CustomerSuggestion) {
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    searchSeq.current++;
    setPhone(s.phone);
    setCustomerName(s.name);
    if (!whatsappTouched.current) setWhatsapp(s.whatsapp || s.phone);
    setSuggestions([]);
    const found = await lookupCustomer(s.phone);
    if (found) {
      setCustomerName(found.name);
      if (found.whatsapp) { whatsappTouched.current = true; setWhatsapp(found.whatsapp); }
    }
  }

  function validate(): string | null {
    if (!customerName.trim()) return "Customer name is required";
    if (!phone.trim()) return "Phone number is required";
    if (pickBranch && !branchId) return "Branch is required";
    if (!requiredDate) return "Required date is required";
    if (!requiredTime) return "Required time is required";
    for (const c of cakes) {
      if (String(c.price).trim() !== "" && Number(c.price) <= 0) return "Each cake needs a price greater than 0";
      if (Number(c.price || 0) > 0 && !c.flavor.trim()) return "Cake flavour is required";
      if (Number(c.price || 0) > 0 && !(Number(c.qty || 0) > 0)) return "Each cake needs a quantity or weight";
    }
    for (const it of items) {
      const touched = it.name.trim() !== "" || String(it.price).trim() !== "";
      if (!touched) continue;
      if (!it.name.trim()) return "Bakery item is required";
      if (!(Number(it.qty || 0) > 0)) return "Quantity must be greater than 0";
      if (!(Number(it.price || 0) > 0)) return "Each item needs a price greater than 0";
    }
    if (includedCakes.length + includedItems.length === 0) return "Add at least one cake or item";
    if (Number(advancePaid || 0) > total) return "Advance paid cannot be greater than total amount";
    return null;
  }

  function submit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);

    const orderType =
      includedCakes.length > 0 && includedItems.length > 0
        ? "MIXED"
        : includedItems.length > 0
          ? "FRESH_BAKES"
          : "CAKE";

    const payload: Record<string, unknown> = {
      customerName,
      phone,
      whatsapp: whatsapp || phone,
      branchId,
      assignedStaff,
      requiredDate,
      requiredTime,
      deliveryType: "PICKUP",
      orderType,
      cakePrice: String(total),
      advancePaid: advancePaid || "0",
      cakes: includedCakes.map((c) => ({
        cakeCategory: "Cake",
        cakeFlavor: c.flavor,
        cakeShape: "",
        cakeWeight: measureToCakeWeight(c.qty, c.unit),
        tiers: "1",
        eggOption: "EGG",
        sugarFree: false,
        theme: "",
        colorPreference: "",
        cakeMessage: c.message,
        designDescription: "",
        specialInstructions: c.instructions,
        price: c.price,
      })),
      bakeItems: includedItems.map((it) => ({
        name: it.name,
        quantity: it.qty,
        unit: it.unit,
        price: it.price,
        notes: it.notes,
      })),
    };

    // Mirror the primary flat columns from the first included line.
    if (includedCakes.length > 0) {
      const f = includedCakes[0];
      Object.assign(payload, {
        cakeCategory: "Cake",
        cakeFlavor: f.flavor,
        cakeWeight: measureToCakeWeight(f.qty, f.unit),
        cakeMessage: f.message,
        specialInstructions: f.instructions,
        tiers: "1",
        eggOption: "EGG",
      });
    } else {
      const f = includedItems[0];
      Object.assign(payload, { bakeItem: f.name, bakeQuantity: f.qty, bakeUnit: f.unit, specialInstructions: f.notes });
    }

    start(async () => {
      try {
        const res = await createOrder(payload);
        if (!res.ok) { setError(res.error); return; }
        router.push(`/orders?d=${requiredDate}`);
        router.refresh();
      } catch {
        setError("Couldn't save — the server or database is unreachable. Please try again.");
      }
    });
  }

  const showTypeToggle = cakesEnabled && freshBakesEnabled;

  return (
    <div className="mx-auto max-w-2xl px-3 py-4 pb-28 md:px-6">
      <h1 className="mb-3 text-xl font-bold text-brand-dark">New Order · Lite</h1>

      <div className="grid gap-4 rounded-2xl border border-black/5 bg-card p-4 shadow-sm sm:grid-cols-2">
        {/* Mobile + name */}
        <Fieldset label="Mobile number" required>
          <div className="relative">
            <Input
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              inputMode="tel"
              placeholder="9812345678"
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-black/10 bg-card shadow-lg">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onPointerDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{s.name}</span>
                        <span className="block text-foreground/50">{s.phone}</span>
                      </span>
                      <span className="shrink-0 text-xs text-foreground/40">
                        {CUSTOMER_TYPE_LABEL[s.customerType] ?? s.customerType} · {s.totalOrders} order(s)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Fieldset>
        <Fieldset label="Customer name" required>
          <Input value={customerName} onChange={(e) => setCustomerName(e.target.value.toUpperCase())} />
        </Fieldset>

        {/* Branch + staff */}
        {pickBranch && (
          <Fieldset label="Branch" required>
            <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {!branchId && <option value="" disabled>Select branch…</option>}
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Fieldset>
        )}
        {staffMembers.length > 0 && (
          <Fieldset label="Staff">
            <Select value={assignedStaff} onChange={(e) => setAssignedStaff(e.target.value)}>
              <option value="">No staff</option>
              {staffMembers.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Fieldset>
        )}

        {/* Required date + time */}
        <Fieldset label="Required date" required>
          <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
        </Fieldset>
        <Fieldset label="Required time" required>
          <TimePicker12 value={requiredTime} onChange={setRequiredTime} />
        </Fieldset>

        {/* Product type toggle */}
        {showTypeToggle && (
          <div className="sm:col-span-2 flex gap-2">
            {([["CAKE", "🎂 Cake", includedCakes.length], ["FRESH_BAKES", "🥐 Fresh Bakes", includedItems.length]] as const).map(([val, label, count]) => (
              <button
                key={val}
                type="button"
                onClick={() => { setProductType(val); setError(null); }}
                className={cn(
                  "flex-1 rounded-xl border py-2.5 text-sm font-medium uppercase transition",
                  productType === val ? "border-brand bg-brand text-white" : "border-black/10 bg-white text-foreground/70"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-xs", productType === val ? "bg-white/25" : "bg-brand/10 text-brand-dark")}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Cake lines */}
        {productType === "CAKE" && (
          <div className="sm:col-span-2 space-y-3">
            {cakes.map((c, i) => (
              <div key={i} className={cn("rounded-xl border border-black/10 p-3", i % 2 === 0 ? "bg-rose-50/70" : "bg-amber-50/70")}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">{cakes.length > 1 ? `Cake ${i + 1}` : "Cake details"}</h3>
                  {cakes.length > 1 && (
                    <button type="button" onClick={() => removeCake(i)} className="flex items-center gap-1 text-xs font-medium text-rose-600">
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fieldset label="Cake flavour" required>
                    <AttributePicker
                      value={c.flavor}
                      onChange={(val) => patchCake(i, { flavor: val })}
                      base={CAKE_FLAVORS}
                      custom={flavors}
                      onCustomChange={setFlavors}
                      onAdd={addCakeFlavor}
                      onRemove={removeCakeFlavor}
                      selectLabel="Select flavor"
                      createLabel="Create flavor"
                      inputPlaceholder="New flavor"
                    />
                  </Fieldset>
                  <Fieldset label="Price (₹)" required>
                    <Input type="number" min={0} placeholder="0" value={c.price} onChange={(e) => patchCake(i, { price: e.target.value })} />
                  </Fieldset>
                  <MeasureField qty={c.qty} unit={c.unit} onChange={(qty, unit) => patchCake(i, { qty, unit })} />
                  <Fieldset label="Message on cake" className="sm:col-span-2">
                    <Input value={c.message} onChange={(e) => patchCake(i, { message: e.target.value.toUpperCase() })} />
                  </Fieldset>
                  <Fieldset label="Special instructions" className="sm:col-span-2">
                    <Textarea value={c.instructions} onChange={(e) => patchCake(i, { instructions: e.target.value.toUpperCase() })} />
                  </Fieldset>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setCakes((p) => [...p, cakeLine()])}>
                <Plus size={16} /> Add another cake
              </Button>
            </div>
          </div>
        )}

        {/* Fresh-bake item lines */}
        {productType === "FRESH_BAKES" && (
          <div className="sm:col-span-2 space-y-3">
            {items.map((it, i) => (
              <div key={i} className={cn("rounded-xl border border-black/10 p-3", i % 2 === 0 ? "bg-rose-50/70" : "bg-amber-50/70")}>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-brand-dark">{items.length > 1 ? `Item ${i + 1}` : "Item details"}</h3>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)} className="flex items-center gap-1 text-xs font-medium text-rose-600">
                      <Trash2 size={14} /> Remove
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Fieldset label="Bakery item" required>
                    <BakeItemPicker
                      value={it.name}
                      onChange={(val) => patchItem(i, { name: val })}
                      base={FRESH_BAKE_ITEMS}
                      custom={bakeNames}
                      onCustomChange={setBakeNames}
                    />
                  </Fieldset>
                  <Fieldset label="Price (₹)" required>
                    <Input type="number" min={0} placeholder="0" value={it.price} onChange={(e) => patchItem(i, { price: e.target.value })} />
                  </Fieldset>
                  <MeasureField qty={it.qty} unit={it.unit} onChange={(qty, unit) => patchItem(i, { qty, unit })} />
                  <Fieldset label="Notes / instructions" className="sm:col-span-2">
                    <Textarea value={it.notes} onChange={(e) => patchItem(i, { notes: e.target.value.toUpperCase() })} placeholder="Flavour, packing, message…" />
                  </Fieldset>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setItems((p) => [...p, itemLine()])}>
                <Plus size={16} /> Add another item
              </Button>
            </div>
          </div>
        )}

        {/* Advance + balance */}
        <Fieldset label="Advance paid (₹)" className="sm:col-span-2">
          <Input type="number" min={0} placeholder="0" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
        </Fieldset>
        <div className="sm:col-span-2 rounded-xl bg-muted/60 p-3 text-sm">
          <div className="flex justify-between"><span>Total amount</span><span className="font-bold">{inr(total)}</span></div>
          <div className="flex justify-between text-rose-600"><span>Balance</span><span className="font-bold">{inr(balance)}</span></div>
        </div>

        {error && <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      </div>

      {/* Save */}
      <div className="no-print fixed inset-x-0 bottom-14 z-30 border-t border-black/5 bg-card/95 px-3 py-3 backdrop-blur md:bottom-0 md:pl-64">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-foreground/50">Total </span>
            <span className="font-bold">{inr(total)}</span>
            <span className="ml-2 text-rose-600">Bal {inr(balance)}</span>
          </div>
          <Button onClick={submit} disabled={pending} size="lg">
            {pending ? "Saving…" : "Save order"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// "Measure by" Piece/Weight toggle + matching quantity input (two Fieldsets, so
// it drops into the line's 2-col grid). Switching units clears the value.
function MeasureField({ qty, unit, onChange }: { qty: string; unit: MeasureUnit; onChange: (qty: string, unit: MeasureUnit) => void }) {
  return (
    <>
      <Fieldset label="Measure by">
        <div className="flex gap-2">
          {([["PIECE", "Piece"], ["WEIGHT", "Weight"]] as const).map(([m, label]) => {
            const active = m === "PIECE" ? unit === "PIECE" : unit !== "PIECE";
            return (
              <button
                key={m}
                type="button"
                onClick={() => onChange("", m === "PIECE" ? "PIECE" : "KG")}
                className={cn("flex-1 rounded-xl border py-2.5 text-sm uppercase", active ? "border-brand bg-brand text-white" : "border-black/10 bg-white")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Fieldset>
      <Fieldset label={unit === "PIECE" ? "Number of pieces" : "Weight"} required>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step={unit === "PIECE" ? 1 : "any"}
            value={qty}
            onChange={(e) => onChange(e.target.value, unit)}
            className="flex-1"
          />
          {unit !== "PIECE" && (
            <div className="flex gap-1">
              {([["GRAMS", "gms"], ["KG", "kg"]] as const).map(([u, label]) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => onChange("", u)}
                  className={cn("rounded-xl border px-3 text-sm", unit === u ? "border-brand bg-brand text-white" : "border-black/10 bg-white")}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Fieldset>
    </>
  );
}

// 12-hour time picker (hour / minute / AM-PM) that emits a 24h "HH:mm" string —
// mirrors the Pro order form's time control.
function TimePicker12({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hasValue = Boolean(value);
  const [hStr, mStr] = (value || "00:00").split(":");
  const h24 = Number(hStr);
  const minute = (mStr ?? "00").padStart(2, "0");
  const period: "AM" | "PM" = h24 < 12 ? "AM" : "PM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;

  const stepMinutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  const minuteOptions = stepMinutes.includes(minute) ? stepMinutes : [minute, ...stepMinutes];

  function emit(nextH12: number, nextMinute: string, nextPeriod: "AM" | "PM") {
    let h = nextH12 % 12;
    if (nextPeriod === "PM") h += 12;
    onChange(`${String(h).padStart(2, "0")}:${nextMinute.padStart(2, "0")}`);
  }

  return (
    <div className="flex gap-2">
      <Select value={hasValue ? String(h12) : ""} onChange={(e) => emit(Number(e.target.value), hasValue ? minute : "00", hasValue ? period : "PM")} aria-label="Hour">
        <option value="" disabled>Hour</option>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((hr) => (
          <option key={hr} value={hr}>{hr}</option>
        ))}
      </Select>
      <Select value={hasValue ? minute : ""} onChange={(e) => emit(h12, e.target.value, period)} disabled={!hasValue} aria-label="Minute">
        {!hasValue && <option value="" disabled>Min</option>}
        {minuteOptions.map((mm) => (
          <option key={mm} value={mm}>{mm}</option>
        ))}
      </Select>
      <Select value={hasValue ? period : ""} onChange={(e) => emit(h12, minute, e.target.value as "AM" | "PM")} disabled={!hasValue} aria-label="AM or PM">
        {!hasValue && <option value="" disabled>--</option>}
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </Select>
    </div>
  );
}
