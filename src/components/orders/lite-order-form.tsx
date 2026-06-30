"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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

// Today as a local "YYYY-MM-DD" (no timezone shift).
function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
  const [requiredDate, setRequiredDate] = useState(defaultDate || todayKey());
  const [requiredTime, setRequiredTime] = useState("");

  const [productType, setProductType] = useState<"CAKE" | "FRESH_BAKES">(cakesEnabled ? "CAKE" : "FRESH_BAKES");
  const [cakeFlavor, setCakeFlavor] = useState("");
  const [bakeName, setBakeName] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState<MeasureUnit>("PIECE");
  const [cakeMessage, setCakeMessage] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [price, setPrice] = useState("");
  const [advancePaid, setAdvancePaid] = useState("");

  // Shared custom-option lists (so an added flavour/item sticks for this session).
  const [flavors, setFlavors] = useState<string[]>(customCakeFlavors);
  const [bakeItems, setBakeItems] = useState<string[]>(customBakeItems);

  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchSeq = useRef(0);

  const total = Math.max(0, Number(price || 0));
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
    if (productType === "FRESH_BAKES" && !bakeName.trim()) return "Bakery item is required";
    if (!(Number(qty || 0) > 0)) return productType === "CAKE" && unit !== "PIECE" ? "Weight is required" : "Quantity is required";
    if (!(Number(price || 0) > 0)) return "Price must be greater than 0";
    if (Number(advancePaid || 0) > total) return "Advance paid cannot be greater than total amount";
    return null;
  }

  function submit() {
    const err = validate();
    if (err) { setError(err); return; }
    setError(null);

    const common = {
      customerName,
      phone,
      whatsapp: whatsapp || phone,
      branchId,
      assignedStaff,
      requiredDate,
      requiredTime,
      deliveryType: "PICKUP",
      cakePrice: String(total),
      advancePaid: advancePaid || "0",
    };

    const payload: Record<string, unknown> =
      productType === "CAKE"
        ? {
            ...common,
            orderType: "CAKE",
            cakeCategory: "Cake",
            cakeFlavor,
            cakeWeight: measureToCakeWeight(qty, unit),
            cakeMessage,
            specialInstructions,
            tiers: "1",
            eggOption: "EGG",
            cakes: [{
              cakeCategory: "Cake",
              cakeFlavor,
              cakeShape: "",
              cakeWeight: measureToCakeWeight(qty, unit),
              tiers: "1",
              eggOption: "EGG",
              sugarFree: false,
              theme: "",
              colorPreference: "",
              cakeMessage,
              designDescription: "",
              specialInstructions,
              price: String(total),
            }],
          }
        : {
            ...common,
            orderType: "FRESH_BAKES",
            bakeItem: bakeName,
            bakeQuantity: qty,
            bakeUnit: unit,
            specialInstructions,
            bakeItems: [{ name: bakeName, quantity: qty, unit, price: String(total), notes: specialInstructions }],
          };

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
        {/* 1. Mobile + 2. Name */}
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

        {/* 3. Branch + Staff */}
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

        {/* 4. Required date + time */}
        <Fieldset label="Required date" required>
          <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
        </Fieldset>
        <Fieldset label="Required time" required>
          <TimePicker12 value={requiredTime} onChange={setRequiredTime} />
        </Fieldset>

        {/* 5. Product: cake (flavour) or fresh bakes (item) */}
        {showTypeToggle && (
          <div className="sm:col-span-2 flex gap-2">
            {([["CAKE", "🎂 Cake"], ["FRESH_BAKES", "🥐 Fresh Bakes"]] as const).map(([val, label]) => (
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
              </button>
            ))}
          </div>
        )}

        {productType === "CAKE" ? (
          <Fieldset label="Cake flavour">
            <AttributePicker
              value={cakeFlavor}
              onChange={setCakeFlavor}
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
        ) : (
          <Fieldset label="Bakery item" required>
            <BakeItemPicker
              value={bakeName}
              onChange={setBakeName}
              base={FRESH_BAKE_ITEMS}
              custom={bakeItems}
              onCustomChange={setBakeItems}
            />
          </Fieldset>
        )}

        {/* 5b. Measure by piece / weight */}
        <Fieldset label="Measure by">
          <div className="flex gap-2">
            {([["PIECE", "Piece"], ["WEIGHT", "Weight"]] as const).map(([m, label]) => {
              const active = m === "PIECE" ? unit === "PIECE" : unit !== "PIECE";
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setUnit(m === "PIECE" ? "PIECE" : "KG"); setQty(""); }}
                  className={cn(
                    "flex-1 rounded-xl border py-2.5 text-sm uppercase",
                    active ? "border-brand bg-brand text-white" : "border-black/10 bg-white"
                  )}
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
              onChange={(e) => setQty(e.target.value)}
              className="flex-1"
            />
            {unit !== "PIECE" && (
              <div className="flex gap-1">
                {([["GRAMS", "gms"], ["KG", "kg"]] as const).map(([u, label]) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => { setUnit(u); setQty(""); }}
                    className={cn(
                      "rounded-xl border px-3 text-sm",
                      unit === u ? "border-brand bg-brand text-white" : "border-black/10 bg-white"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Fieldset>

        {/* 6. Message on cake (cakes only) */}
        {productType === "CAKE" && (
          <Fieldset label="Message on cake" className="sm:col-span-2">
            <Input value={cakeMessage} onChange={(e) => setCakeMessage(e.target.value.toUpperCase())} />
          </Fieldset>
        )}

        {/* 7. Special instructions */}
        <Fieldset label="Special instructions" className="sm:col-span-2">
          <Textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value.toUpperCase())} />
        </Fieldset>

        {/* 8. Price + 9. Advance */}
        <Fieldset label="Price (₹)" required>
          <Input type="number" min={0} placeholder="0" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Fieldset>
        <Fieldset label="Advance paid (₹)">
          <Input type="number" min={0} placeholder="0" value={advancePaid} onChange={(e) => setAdvancePaid(e.target.value)} />
        </Fieldset>

        {/* 10. Balance */}
        <div className="sm:col-span-2 rounded-xl bg-muted/60 p-3 text-sm">
          <div className="flex justify-between"><span>Total amount</span><span className="font-bold">{inr(total)}</span></div>
          <div className="flex justify-between text-rose-600"><span>Balance</span><span className="font-bold">{inr(balance)}</span></div>
        </div>

        {error && <p className="sm:col-span-2 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      </div>

      {/* 11. Save */}
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
