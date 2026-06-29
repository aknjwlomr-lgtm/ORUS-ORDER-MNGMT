"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Cake, Truck, IndianRupee, CheckCircle2, ChevronDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Fieldset } from "@/components/ui/field";
import { cn, inr, bakeQty } from "@/lib/utils";
import {
  CUSTOMER_TYPE_LABEL, CAKE_CATEGORIES, CAKE_FLAVORS,
  CAKE_SHAPES, DELIVERY_TYPES, DELIVERY_TYPE_LABEL, PRIORITIES, PRIORITY_LABEL,
  PAYMENT_MODES, PAYMENT_MODE_LABEL, FRESH_BAKE_ITEMS,
} from "@/lib/constants";
import {
  createOrder, updateOrder, lookupCustomer, searchCustomers,
  addCakeFlavor, removeCakeFlavor, addCakeShape, removeCakeShape,
} from "@/app/(app)/orders/actions";
import { BakeItemPicker } from "@/components/orders/bake-item-picker";
import { CakeCategoryPicker } from "@/components/orders/cake-category-picker";
import { AttributePicker } from "@/components/orders/attribute-picker";

export type OrderFormValues = Record<string, string | boolean>;

// A single cake within a CAKE order. The form keeps a list of these so an order
// can contain several cakes, each with its own details and price.
export type CakeValues = {
  cakeCategory: string;
  cakeFlavor: string;
  cakeShape: string;
  cakeWeight: string;
  tiers: string;
  eggOption: string;
  sugarFree: boolean;
  theme: string;
  colorPreference: string;
  cakeMessage: string;
  designDescription: string;
  specialInstructions: string;
  price: string;
};

function cakeDefaults(): CakeValues {
  return {
    cakeCategory: "", cakeFlavor: "", cakeShape: "",
    cakeWeight: "", tiers: "1", eggOption: "EGG", sugarFree: false,
    theme: "", colorPreference: "", cakeMessage: "", designDescription: "",
    specialInstructions: "", price: "",
  };
}

// A single item within a FRESH_BAKES order. The form keeps a list of these so an
// order can contain several bakery items, each with its own quantity and price.
export type BakeItemValues = {
  name: string;
  quantity: string;
  unit: string;
  price: string;
  notes: string;
};

function bakeItemDefaults(): BakeItemValues {
  return { name: "", quantity: "", unit: "PIECE", price: "", notes: "" };
}

type CustomerSuggestion = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  customerType: string;
  totalOrders: number;
};

// Cake weight is stored as a compact string ("1.5kg", "500g"). Split it into a
// number + unit for editing, and recombine on change.
function parseWeight(s: string): { num: string; unit: "GRAMS" | "KG" } {
  const m = String(s ?? "").trim().toLowerCase().match(/^([\d.]+)\s*(g|gms?|grams?|kg|kgs?)?$/);
  if (!m) return { num: "", unit: "KG" };
  return { num: m[1] ?? "", unit: (m[2] ?? "kg").startsWith("g") ? "GRAMS" : "KG" };
}
function formatWeight(num: string, unit: "GRAMS" | "KG"): string {
  if (!num) return "";
  return `${num}${unit === "GRAMS" ? "g" : "kg"}`;
}

// Number input + gms/kg toggle, mirroring the Fresh Bakes weight control. The
// unit is tracked locally so switching clears the value yet keeps the unit.
function WeightInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseWeight(value);
  const [unit, setUnit] = useState<"GRAMS" | "KG">(parsed.unit);

  function switchUnit(next: "GRAMS" | "KG") {
    if (next === unit) return;
    setUnit(next);
    onChange(""); // clear the value when switching units
  }

  return (
    <div className="flex gap-2">
      <Input
        type="number"
        min={0}
        step="any"
        placeholder="0"
        value={parsed.num}
        onChange={(e) => onChange(e.target.value ? formatWeight(e.target.value, unit) : "")}
        className="flex-1"
      />
      <div className="flex gap-1">
        {(["GRAMS", "KG"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => switchUnit(u)}
            className={cn(
              "rounded-xl border px-3 text-sm",
              unit === u ? "border-brand bg-brand text-white" : "border-black/10 bg-white"
            )}
          >
            {u === "GRAMS" ? "gms" : "kg"}
          </button>
        ))}
      </div>
    </div>
  );
}

// A cake line is measured either by weight ("1.5kg"/"500g") or by piece
// ("12 pcs"), both stored in the single cakeWeight string.
function parseMeasure(s: string): { mode: "PIECE" | "WEIGHT"; num: string; unit: "GRAMS" | "KG" } {
  const str = String(s ?? "").trim().toLowerCase();
  const pc = str.match(/^([\d.]+)\s*(pc|pcs|piece|pieces)$/);
  if (pc) return { mode: "PIECE", num: pc[1] ?? "", unit: "KG" };
  const w = parseWeight(str);
  return { mode: "WEIGHT", num: w.num, unit: w.unit };
}

// "Measure by" Piece/Weight toggle + matching input, like Fresh Bakes. The mode
// is tracked locally so switching clears the value yet keeps the chosen mode.
function CakeMeasure({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseMeasure(value);
  const [mode, setMode] = useState<"PIECE" | "WEIGHT">(parsed.mode);

  function switchMode(next: "PIECE" | "WEIGHT") {
    if (next === mode) return;
    setMode(next);
    onChange(""); // clear the value when switching measure type
  }

  return (
    <>
      <Fieldset label="Measure by">
        <div className="flex gap-2">
          {([["PIECE", "Piece"], ["WEIGHT", "Weight"]] as const).map(([m, label]) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={cn(
                "flex-1 rounded-xl border py-2.5 text-sm uppercase",
                mode === m ? "border-brand bg-brand text-white" : "border-black/10 bg-white"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Fieldset>
      <Fieldset label={mode === "PIECE" ? "Number of pieces" : "Weight"}>
        {mode === "PIECE" ? (
          <Input
            type="number"
            min={1}
            placeholder="0"
            value={parsed.mode === "PIECE" ? parsed.num : ""}
            onChange={(e) => onChange(e.target.value ? `${e.target.value} pcs` : "")}
          />
        ) : (
          <WeightInput value={parsed.mode === "WEIGHT" ? value : ""} onChange={onChange} />
        )}
      </Fieldset>
    </>
  );
}

// Format a "YYYY-MM-DD" date as "DD-MM-YYYY".
function ddmmyyyy(d: string): string {
  const [y, m, day] = String(d ?? "").split("-");
  return y && m && day ? `${day}-${m}-${y}` : String(d ?? "");
}

// Weekday name for a "YYYY-MM-DD" date, e.g. "Sunday". Built from local parts so
// it isn't shifted by the timezone.
function weekday(d: string): string {
  const [y, m, day] = String(d ?? "").split("-").map(Number);
  if (!y || !m || !day) return "";
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { weekday: "long" });
}

// Format a stored 24h "HH:mm" value as 12-hour with AM/PM, e.g. "17:00" -> "5:00 PM".
function to12h(hhmm: string): string {
  if (!hhmm) return "";
  const [hStr, mStr] = hhmm.split(":");
  let h = Number(hStr);
  const m = (mStr ?? "00").padStart(2, "0");
  const period = h < 12 ? "AM" : "PM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

const SECTIONS = [
  { id: "customer", label: "Customer", icon: User },
  { id: "cake", label: "Orders", icon: Cake },
  { id: "delivery", label: "Delivery", icon: Truck },
  { id: "pricing", label: "Pricing", icon: IndianRupee },
  { id: "confirm", label: "Confirm", icon: CheckCircle2 },
] as const;

function defaults(defaultDate?: string): OrderFormValues {
  return {
    customerName: "", phone: "", whatsapp: "", email: "", address: "", branchId: "",
    customerType: "NEW", occasion: "Birthday", customerNotes: "",
    orderType: "CAKE", bakeItem: "", bakeQuantity: "", bakeUnit: "PIECE",
    cakeCategory: "", cakeFlavor: "", cakeShape: "",
    cakeWeight: "", tiers: "1", eggOption: "EGG", sugarFree: false,
    theme: "", colorPreference: "", cakeMessage: "", designDescription: "", specialInstructions: "",
    requiredDate: defaultDate ?? "", requiredTime: "",
    deliveryType: "PICKUP", deliveryAddress: "", deliveryPerson: "", priority: "NORMAL",
    cakePrice: "", extraCharge: "", deliveryCharge: "", tax: "", discount: "",
    advancePaid: "", paymentMode: "CASH", paymentRef: "", billingNotes: "",
    assignedBaker: "", assignedDecorator: "", prepStatus: "Pending",
    kitchenNotes: "", packagingNotes: "", staffComments: "",
  };
}

export function OrderForm({
  mode,
  orderId,
  initial,
  initialCakes,
  initialBakeItems,
  defaultDate,
  customBakeItems = [],
  customCakeCategories = [],
  customCakeFlavors = [],
  customCakeShapes = [],
  customCakeWeights = [],
  branches = [],
  pickBranch = false,
  customerDirectory = [],
  cakesEnabled = true,
  freshBakesEnabled = true,
}: {
  mode: "create" | "edit";
  orderId?: string;
  initial?: OrderFormValues;
  initialCakes?: CakeValues[];
  initialBakeItems?: BakeItemValues[];
  defaultDate?: string;
  customBakeItems?: string[];
  customCakeCategories?: string[];
  customCakeFlavors?: string[];
  customCakeShapes?: string[];
  customCakeWeights?: string[];
  branches?: { id: string; name: string }[];
  pickBranch?: boolean;
  customerDirectory?: CustomerSuggestion[];
  cakesEnabled?: boolean;
  freshBakesEnabled?: boolean;
}) {
  const router = useRouter();
  // Both toggles can't be off (enforced in settings); when cakes are disabled the
  // form opens straight on Fresh Bakes. Used for the initial view and resets.
  const defaultType = cakesEnabled ? "CAKE" : "FRESH_BAKES";
  const [v, setV] = useState<OrderFormValues>(() => {
    const base: OrderFormValues = { ...defaults(defaultDate), ...(initial ?? {}) };
    if (base.orderType === "CAKE" && !cakesEnabled) base.orderType = "FRESH_BAKES";
    else if (base.orderType === "FRESH_BAKES" && !freshBakesEnabled) base.orderType = "CAKE";
    return base;
  });
  // The cakes on a CAKE order. Always at least one; FRESH_BAKES ignores this.
  const [cakes, setCakes] = useState<CakeValues[]>(
    initialCakes && initialCakes.length > 0 ? initialCakes : [cakeDefaults()]
  );
  // The items on a FRESH_BAKES order. Always at least one; CAKE ignores this.
  const [bakeItems, setBakeItems] = useState<BakeItemValues[]>(
    initialBakeItems && initialBakeItems.length > 0 ? initialBakeItems : [bakeItemDefaults()]
  );
  const [section, setSection] = useState<(typeof SECTIONS)[number]["id"]>("customer");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [success, setSuccess] = useState<{ id: string; number: string } | null>(null);
  const [suggestions, setSuggestions] = useState<CustomerSuggestion[]>([]);
  const [showMore, setShowMore] = useState(false);
  // One "Show more" toggle per cake card, so each cake expands independently.
  const [expandedCakes, setExpandedCakes] = useState<boolean[]>(() =>
    Array(initialCakes && initialCakes.length > 0 ? initialCakes.length : 1).fill(false)
  );
  const [showMorePricing, setShowMorePricing] = useState(false);
  // Custom option lists live here (not inside each picker) so a value created or
  // deleted in one cake/item row is reflected in every other row — and in any new
  // row added afterwards.
  const [cakeCategories, setCakeCategories] = useState<string[]>(customCakeCategories);
  const [cakeFlavors, setCakeFlavors] = useState<string[]>(customCakeFlavors);
  const [cakeShapes, setCakeShapes] = useState<string[]>(customCakeShapes);
  const [freshBakeItems, setFreshBakeItems] = useState<string[]>(customBakeItems);
  const phoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Bumped on every new/cancelled search so a slow, already-in-flight lookup
  // can't apply stale results (which re-opened the dropdown after selecting).
  const searchSeq = useRef(0);
  // WhatsApp mirrors the mobile number until the user edits it directly.
  const whatsappTouched = useRef<boolean>(Boolean(initial?.whatsapp));

  const set = (k: string, val: string | boolean) => setV((p) => ({ ...p, [k]: val }));
  const n = (k: string) => Number(v[k] || 0);

  // Discard the in-progress order and return to a blank form.
  const resetDraft = useCallback(() => {
    setSuccess(null);
    setError(null);
    setSuggestions([]);
    setV({ ...defaults(defaultDate), orderType: defaultType });
    setCakes([cakeDefaults()]);
    setBakeItems([bakeItemDefaults()]);
    setSection("customer");
  }, [defaultDate, defaultType]);

  // Navigating to another section (Orders, Reminders, …) unmounts this form, so
  // its draft is dropped and the next visit starts blank. The one case React
  // can't catch is a browser back-forward cache restore — e.g. returning to the
  // installed app after tapping a phone / WhatsApp link — which brings the whole
  // frozen page back filled in. Clear it then too (create mode only).
  useEffect(() => {
    if (mode !== "create") return;
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) resetDraft();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [mode, resetDraft]);

  // Cake list helpers (CAKE orders only).
  const setCake = (i: number, k: keyof CakeValues, val: string | boolean) =>
    setCakes((p) => p.map((c, idx) => (idx === i ? { ...c, [k]: val } : c)));
  const addCake = () => {
    setCakes((p) => [...p, cakeDefaults()]);
    setExpandedCakes((p) => [...p, false]);
  };
  const removeCake = (i: number) => {
    setCakes((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
    setExpandedCakes((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  };
  const toggleCakeExpanded = (i: number) =>
    setExpandedCakes((p) => p.map((e, idx) => (idx === i ? !e : e)));
  const cakesSubtotal = useMemo(
    () => cakes.reduce((s, c) => s + Number(c.price || 0), 0),
    [cakes]
  );

  // Bake-item list helpers (FRESH_BAKES orders only).
  const setBakeItem = (i: number, k: keyof BakeItemValues, val: string) =>
    setBakeItems((p) => p.map((it, idx) => (idx === i ? { ...it, [k]: val } : it)));
  // Switching the unit (piece/weight, or gms/kg) clears the quantity so a value
  // entered for one unit isn't mistaken for another.
  const setBakeUnit = (i: number, unit: string) =>
    setBakeItems((p) =>
      p.map((it, idx) => (idx === i ? { ...it, unit, quantity: unit === it.unit ? it.quantity : "" } : it))
    );
  const addBakeItem = () => setBakeItems((p) => [...p, bakeItemDefaults()]);
  const removeBakeItem = (i: number) =>
    setBakeItems((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p));
  const bakeItemsSubtotal = useMemo(
    () => bakeItems.reduce((s, it) => s + Number(it.price || 0), 0),
    [bakeItems]
  );

  // The toggle only chooses which list is on screen — both are saved. A line
  // counts toward the order once it has a price (items also need a name); blank
  // starter lines are ignored. The order's type is derived from what's included.
  const includedCakes = useMemo(() => cakes.filter((c) => Number(c.price || 0) > 0), [cakes]);
  const includedItems = useMemo(
    () => bakeItems.filter((it) => it.name.trim() !== "" && Number(it.price || 0) > 0),
    [bakeItems]
  );
  const productSubtotal = cakesSubtotal + bakeItemsSubtotal;
  // Charges (delivery, tax, …) only apply once there's at least one product, so a
  // bare delivery charge can't make an otherwise-empty order show a total.
  const hasProducts = includedCakes.length > 0 || includedItems.length > 0;

  // Cake/pricing "Show more" sections can't be collapsed while any of their
  // fields hold a value — cleared first, so filled-in data isn't hidden by
  // accident. (The customer section collapses freely.)
  const pricingExtraDirty =
    n("extraCharge") > 0 || n("deliveryCharge") > 0 || n("tax") > 0 ||
    String(v.paymentRef).trim() !== "" || String(v.billingNotes).trim() !== "";
  const cakeExtraDirty = (c: CakeValues) =>
    c.cakeShape.trim() !== "" ||
    c.theme.trim() !== "" ||
    c.colorPreference.trim() !== "" ||
    c.designDescription.trim() !== "" ||
    c.specialInstructions.trim() !== "" ||
    c.sugarFree ||
    (c.tiers !== "" && c.tiers !== "1") ||
    c.eggOption !== "EGG";

  // Validate every line the user has started filling, and require at least one.
  function productError(): string | null {
    for (const c of cakes) {
      if (String(c.price).trim() !== "" && Number(c.price) <= 0) return "Each cake needs a price greater than 0";
    }
    for (const it of bakeItems) {
      const touched = it.name.trim() !== "" || String(it.price).trim() !== "";
      if (!touched) continue;
      if (!it.name.trim()) return "Bakery item is required";
      if (Number(it.quantity || 0) <= 0) return "Quantity must be greater than 0";
      if (Number(it.price || 0) <= 0) return "Each item needs a price greater than 0";
    }
    if (includedCakes.length + includedItems.length === 0) return "Add at least one cake or fresh-bake item";
    return null;
  }

  // Switching tabs collapses any expanded "Show more" sections.
  function changeSection(id: (typeof SECTIONS)[number]["id"]) {
    setSection(id);
    // Customer "Show more" always collapses on tab change. Cake/pricing keep any
    // that still hold values open (so those values aren't hidden unexpectedly).
    setShowMore(false);
    setExpandedCakes((p) => p.map((_, i) => (cakes[i] ? cakeExtraDirty(cakes[i]) : false)));
    setShowMorePricing(pricingExtraDirty);
  }

  const sectionIndex = SECTIONS.findIndex((s) => s.id === section);
  const isLastSection = sectionIndex === SECTIONS.length - 1;

  // Mandatory-field checks for a single tab. Returns an error message or null.
  function validateSection(id: (typeof SECTIONS)[number]["id"]): string | null {
    switch (id) {
      case "customer":
        if (!String(v.customerName).trim()) return "Customer name is required";
        if (!String(v.phone).trim()) return "Phone number is required";
        if (pickBranch && !String(v.branchId).trim()) return "Branch is required";
        return null;
      case "cake":
        return productError();
      case "delivery":
        if (!String(v.requiredDate)) return "Required date is required";
        if (!String(v.requiredTime)) return "Required time is required";
        if (v.deliveryType === "HOME_DELIVERY" && !String(v.deliveryAddress).trim() && !String(v.address).trim())
          return "Delivery address is required for home delivery";
        return null;
      case "pricing": {
        const pErr = productError();
        if (pErr) return pErr;
        if (n("advancePaid") > totals.total) return "Advance paid cannot be greater than total amount";
        return null;
      }
      default:
        return null;
    }
  }

  // Advance to the next tab only when the current tab's required fields are filled.
  function goNext() {
    const err = validateSection(section);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const next = SECTIONS[Math.min(sectionIndex + 1, SECTIONS.length - 1)];
    changeSection(next.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totals = useMemo(() => {
    // An order can contain cakes and/or fresh bakes; the total sums both. With no
    // product yet, the order is empty so the total is 0 — charges don't count.
    const total = hasProducts
      ? Math.max(0, productSubtotal + n("extraCharge") + n("deliveryCharge") + n("tax") - n("discount"))
      : 0;
    const balance = total - (hasProducts ? n("advancePaid") : 0);
    return { total, balance };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProducts, productSubtotal, v.extraCharge, v.deliveryCharge, v.tax, v.discount, v.advancePaid]);

  function fillFromCustomer(found: NonNullable<Awaited<ReturnType<typeof lookupCustomer>>>) {
    if (found.whatsapp) whatsappTouched.current = true;
    setV((p) => ({
      ...p,
      customerName: found.name,
      whatsapp: found.whatsapp ?? p.phone,
      email: found.email ?? "",
      address: found.address ?? "",
      customerType: found.customerType,
      customerNotes: found.notes ?? "",
    }));
  }

  // Live suggestions while typing the phone number (debounced).
  function onPhoneChange(value: string) {
    set("phone", value);
    // Default WhatsApp number to the mobile number until edited manually.
    if (!whatsappTouched.current) set("whatsapp", value);
    const q = value.trim().toLowerCase();
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    if (q.length < 2) {
      searchSeq.current++;
      setSuggestions([]);
      return;
    }
    // Fast path: filter the prefetched directory on the client (instant).
    if (customerDirectory.length > 0) {
      searchSeq.current++;
      const matches = customerDirectory
        .filter((c) =>
          c.phone.toLowerCase().includes(q) ||
          (c.whatsapp ?? "").toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q)
        )
        .slice(0, 6);
      setSuggestions(matches);
      return;
    }
    // Fallback: debounced server search (seq-guarded against stale results).
    const seq = ++searchSeq.current;
    phoneTimer.current = setTimeout(async () => {
      const results = await searchCustomers(q);
      if (seq === searchSeq.current) setSuggestions(results);
    }, 250);
  }

  async function selectSuggestion(s: CustomerSuggestion) {
    // Invalidate any pending/in-flight search so its (possibly slow) result
    // can't re-open the dropdown right after we close it — which forced a
    // second click.
    if (phoneTimer.current) clearTimeout(phoneTimer.current);
    searchSeq.current++;
    set("phone", s.phone);
    set("customerName", s.name);
    set("customerType", s.customerType);
    if (!whatsappTouched.current) set("whatsapp", s.whatsapp || s.phone);
    setSuggestions([]);
    // Pull the rest (email/address/notes) in the background.
    const found = await lookupCustomer(s.phone);
    if (found) fillFromCustomer(found);
  }

  function validate(): string | null {
    if (!String(v.customerName).trim()) return "Customer name is required";
    if (!String(v.phone).trim()) return "Phone number is required";
    if (pickBranch && !String(v.branchId).trim()) return "Branch is required";
    const pErr = productError();
    if (pErr) return pErr;
    if (!String(v.requiredDate)) return "Required date is required";
    if (!String(v.requiredTime)) return "Required time is required";
    if (n("advancePaid") > totals.total) return "Advance paid cannot be greater than total amount";
    if (v.deliveryType === "HOME_DELIVERY" && !String(v.deliveryAddress).trim() && !String(v.address).trim())
      return "Delivery address is required for home delivery";
    return null;
  }

  function submit() {
    const err = validate();
    if (err) {
      setError(err);
      setSection("confirm");
      return;
    }
    setError(null);
    // Send both lists (only priced lines). The order type is derived from what's
    // included, and the primary flat columns mirror the first cake, or the first
    // item when there are no cakes. cakePrice is the combined subtotal.
    const orderType =
      includedCakes.length > 0 && includedItems.length > 0
        ? "MIXED"
        : includedItems.length > 0
          ? "FRESH_BAKES"
          : "CAKE";
    const payload: Record<string, unknown> = {
      ...v,
      orderType,
      cakes: includedCakes,
      bakeItems: includedItems,
      cakePrice: String(productSubtotal),
    };
    if (includedCakes.length > 0) {
      const first = includedCakes[0];
      payload.cakeCategory = first.cakeCategory;
      payload.cakeFlavor = first.cakeFlavor;
      payload.cakeShape = first.cakeShape;
      payload.cakeWeight = first.cakeWeight;
      payload.tiers = first.tiers;
      payload.eggOption = first.eggOption;
      payload.sugarFree = first.sugarFree;
      payload.theme = first.theme;
      payload.colorPreference = first.colorPreference;
      payload.cakeMessage = first.cakeMessage;
      payload.designDescription = first.designDescription;
      payload.specialInstructions = first.specialInstructions;
    } else {
      const first = includedItems[0];
      payload.bakeItem = first.name;
      payload.bakeQuantity = first.quantity;
      payload.bakeUnit = first.unit;
    }
    start(async () => {
      try {
        const res = mode === "create" ? await createOrder(payload) : await updateOrder(orderId!, payload);
        if (!res.ok) {
          setError(res.error);
          setSection("confirm");
          return;
        }
        if (mode === "create") {
          setSuccess({ id: res.orderId, number: res.orderNumber });
        } else {
          router.push(`/orders/${res.orderId}`);
          router.refresh();
        }
      } catch {
        setError("Couldn't save — the server or database is unreachable. Please check your connection and try again.");
        setSection("confirm");
      }
    });
  }

  if (success) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 size={36} />
        </div>
        <h2 className="text-xl font-bold">Order saved!</h2>
        <p className="mt-1 font-mono text-brand-dark">{success.number}</p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Link href={`/orders/${success.id}/receipt`}><Button variant="outline" className="w-full">🧾 Print receipt</Button></Link>
          <Link href={`/reminders/new?order=${success.id}`}><Button variant="outline" className="w-full">🔔 Add reminder</Button></Link>
          <Link href={`/orders/${success.id}`}><Button variant="outline" className="w-full">👁 View order</Button></Link>
          <Button className="w-full" onClick={resetDraft}>➕ New order</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 pb-28 md:px-6">
      <h1 className="mb-3 text-xl font-bold text-brand-dark">{mode === "create" ? "New Order" : "Edit Order"}</h1>

      {/* Section tabs */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => changeSection(s.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition",
                section === s.id ? "border-brand bg-brand text-white" : "border-black/10 bg-card text-foreground/70"
              )}
            >
              <Icon size={15} /> {s.label}
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
        {section === "customer" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Fieldset label="Mobile number" required>
              <div className="relative">
                <Input
                  value={String(v.phone)}
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
                          // Select on pointerdown (mouse + touch, fires once before the
                          // input's blur + re-render) so a single tap reliably registers.
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
              <Input value={String(v.customerName)} onChange={(e) => set("customerName", e.target.value.toUpperCase())} />
            </Fieldset>
            {pickBranch && (
              <Fieldset label="Branch" required className="sm:col-span-2">
                <Select value={String(v.branchId)} onChange={(e) => set("branchId", e.target.value)}>
                  {!v.branchId && <option value="" disabled>Select branch…</option>}
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Fieldset>
            )}

            <button
              type="button"
              onClick={() => setShowMore((s) => !s)}
              className="sm:col-span-2 flex items-center gap-1.5 text-sm font-medium text-brand-dark"
            >
              <ChevronDown size={16} className={cn("transition-transform", showMore && "rotate-180")} />
              {showMore ? "Show less" : "Show more"}
            </button>

            {showMore && (
              <>
                <Fieldset label="WhatsApp number">
                  <Input value={String(v.whatsapp)} onChange={(e) => { whatsappTouched.current = true; set("whatsapp", e.target.value); }} inputMode="tel" />
                </Fieldset>
                <Fieldset label="Customer type">
                  <div className="flex h-[42px] items-center rounded-xl border border-black/10 bg-muted/40 px-3 text-sm text-foreground/70">
                    {CUSTOMER_TYPE_LABEL[String(v.customerType)] ?? String(v.customerType)}
                    <span className="ml-1.5 text-xs text-foreground/40">· set automatically</span>
                  </div>
                </Fieldset>
                <Fieldset label="Address" className="sm:col-span-2">
                  <Textarea value={String(v.address)} onChange={(e) => set("address", e.target.value.toUpperCase())} />
                </Fieldset>
                <Fieldset label="Notes about customer" className="sm:col-span-2">
                  <Input value={String(v.customerNotes)} onChange={(e) => set("customerNotes", e.target.value.toUpperCase())} />
                </Fieldset>
              </>
            )}
          </div>
        )}

        {section === "cake" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Order type: switches the view only — both lists are saved together.
                Hidden when only one type is enabled in Settings. */}
            {cakesEnabled && freshBakesEnabled && (
            <div className="sm:col-span-2">
              <div className="flex gap-2">
                {([["CAKE", "🎂 Cake", includedCakes.length], ["FRESH_BAKES", "🥐 Fresh Bakes", includedItems.length]] as const).map(([val, label, count]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => { set("orderType", val); setError(null); }}
                    className={cn(
                      "flex-1 rounded-xl border py-2.5 text-sm font-medium transition uppercase",
                      v.orderType === val ? "border-brand bg-brand text-white" : "border-black/10 bg-white text-foreground/70"
                    )}
                  >
                    {label}
                    {count > 0 && (
                      <span className={cn(
                        "ml-1.5 rounded-full px-1.5 py-0.5 text-xs",
                        v.orderType === val ? "bg-white/25" : "bg-brand/10 text-brand-dark"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-foreground/50">
                Add cakes and fresh bakes to the same order — both are saved and totalled together.
              </p>
            </div>
            )}

            {v.orderType === "FRESH_BAKES" && (
              <div className="sm:col-span-2 space-y-4">
                {bakeItems.map((it, i) => (
                  <div key={i} className={cn("rounded-xl border border-black/10 p-3", i % 2 === 0 ? "bg-rose-50/70" : "bg-amber-50/70")}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-brand-dark">
                        {bakeItems.length > 1 ? `Item ${i + 1}` : "Item details"}
                      </h3>
                      {bakeItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBakeItem(i)}
                          className="flex items-center gap-1 text-xs font-medium text-rose-600"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fieldset label="Bakery item" required>
                        <BakeItemPicker
                          value={it.name}
                          onChange={(val) => setBakeItem(i, "name", val)}
                          base={FRESH_BAKE_ITEMS}
                          custom={freshBakeItems}
                          onCustomChange={setFreshBakeItems}
                        />
                      </Fieldset>
                      <Fieldset label="Price (₹)" required>
                        <Input type="number" placeholder="0" value={it.price} onChange={(e) => setBakeItem(i, "price", e.target.value)} />
                      </Fieldset>
                      <Fieldset label="Measure by">
                        <div className="flex gap-2">
                          {([["PIECE", "Piece"], ["KG", "Weight"]] as const).map(([u, label]) => {
                            const active = u === "PIECE" ? it.unit === "PIECE" : it.unit !== "PIECE";
                            return (
                              <button
                                key={label}
                                type="button"
                                onClick={() => setBakeUnit(i, u)}
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
                      <Fieldset label={it.unit === "PIECE" ? "Number of pieces" : "Weight"} required>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            step={it.unit === "PIECE" ? 1 : "any"}
                            value={it.quantity}
                            onChange={(e) => setBakeItem(i, "quantity", e.target.value)}
                            className="flex-1"
                          />
                          {it.unit !== "PIECE" && (
                            <div className="flex gap-1">
                              {([["GRAMS", "gms"], ["KG", "kg"]] as const).map(([u, label]) => (
                                <button
                                  key={u}
                                  type="button"
                                  onClick={() => setBakeUnit(i, u)}
                                  className={cn(
                                    "rounded-xl border px-3 text-sm",
                                    it.unit === u ? "border-brand bg-brand text-white" : "border-black/10 bg-white"
                                  )}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </Fieldset>
                      <Fieldset label="Notes / instructions" className="sm:col-span-2">
                        <Textarea
                          value={it.notes}
                          onChange={(e) => setBakeItem(i, "notes", e.target.value.toUpperCase())}
                          placeholder="Flavour, packing, message…"
                        />
                      </Fieldset>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={addBakeItem}>
                    <Plus size={16} /> Add another item
                  </Button>
                </div>
              </div>
            )}

            {v.orderType === "CAKE" && (
              <div className="sm:col-span-2 space-y-4">
                {cakes.map((c, i) => (
                  <div key={i} className={cn("rounded-xl border border-black/10 p-3", i % 2 === 0 ? "bg-rose-50/70" : "bg-amber-50/70")}>
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-brand-dark">
                        {cakes.length > 1 ? `Cake ${i + 1}` : "Cake details"}
                      </h3>
                      {cakes.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCake(i)}
                          className="flex items-center gap-1 text-xs font-medium text-rose-600"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Fieldset label="Cake category" required>
                        <CakeCategoryPicker
                          value={c.cakeCategory}
                          onChange={(val) => setCake(i, "cakeCategory", val)}
                          base={CAKE_CATEGORIES}
                          custom={cakeCategories}
                          onCustomChange={setCakeCategories}
                        />
                      </Fieldset>
                      <Fieldset label="Flavor">
                        <AttributePicker
                          value={c.cakeFlavor}
                          onChange={(val) => setCake(i, "cakeFlavor", val)}
                          base={CAKE_FLAVORS}
                          custom={cakeFlavors}
                          onCustomChange={setCakeFlavors}
                          onAdd={addCakeFlavor}
                          onRemove={removeCakeFlavor}
                          selectLabel="Select flavor"
                          createLabel="Create flavor"
                          inputPlaceholder="New flavor"
                        />
                      </Fieldset>
                      <CakeMeasure value={c.cakeWeight} onChange={(val) => setCake(i, "cakeWeight", val)} />
                      <Fieldset label="Price (₹)" required>
                        <Input type="number" placeholder="0" value={c.price} onChange={(e) => setCake(i, "price", e.target.value)} />
                      </Fieldset>
                      <Fieldset label="Message on cake" className="sm:col-span-2">
                        <Input value={c.cakeMessage} onChange={(e) => setCake(i, "cakeMessage", e.target.value.toUpperCase())} />
                      </Fieldset>

                      <button
                        type="button"
                        onClick={() => { if (expandedCakes[i] && cakeExtraDirty(c)) return; toggleCakeExpanded(i); }}
                        disabled={expandedCakes[i] && cakeExtraDirty(c)}
                        title={expandedCakes[i] && cakeExtraDirty(c) ? "Clear the fields below to collapse" : undefined}
                        className={cn(
                          "flex items-center gap-1.5 text-sm font-medium text-brand-dark sm:col-span-2",
                          expandedCakes[i] && cakeExtraDirty(c) && "opacity-50"
                        )}
                      >
                        <ChevronDown size={16} className={cn("transition-transform", expandedCakes[i] && "rotate-180")} />
                        {expandedCakes[i] ? "Show less" : "Show more"}
                        {expandedCakes[i] && cakeExtraDirty(c) && (
                          <span className="text-xs font-normal text-foreground/40">· clear fields to collapse</span>
                        )}
                      </button>

                      {expandedCakes[i] && (
                        <>
                          <Fieldset label="Shape">
                            <AttributePicker
                              value={c.cakeShape}
                              onChange={(val) => setCake(i, "cakeShape", val)}
                              base={CAKE_SHAPES}
                              custom={cakeShapes}
                              onCustomChange={setCakeShapes}
                              onAdd={addCakeShape}
                              onRemove={removeCakeShape}
                              selectLabel="Select shape"
                              createLabel="Create shape"
                              inputPlaceholder="New shape"
                            />
                          </Fieldset>
                          <Fieldset label="Number of tiers">
                            <Input type="number" min={1} value={c.tiers} onChange={(e) => setCake(i, "tiers", e.target.value)} />
                          </Fieldset>
                          <Fieldset label="Egg option">
                            <div className="flex gap-2">
                              {["EGG", "EGGLESS"].map((o) => (
                                <button key={o} type="button" onClick={() => setCake(i, "eggOption", o)}
                                  className={cn("flex-1 rounded-xl border py-2.5 text-sm uppercase", c.eggOption === o ? "border-brand bg-brand text-white" : "border-black/10 bg-white")}>
                                  {o === "EGG" ? "With Egg" : "Eggless"}
                                </button>
                              ))}
                            </div>
                          </Fieldset>
                          <label className="flex items-center gap-2 text-sm sm:col-span-2">
                            <input type="checkbox" checked={c.sugarFree} onChange={(e) => setCake(i, "sugarFree", e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                            Sugar-free
                          </label>
                          <Fieldset label="Theme"><Input value={c.theme} onChange={(e) => setCake(i, "theme", e.target.value.toUpperCase())} /></Fieldset>
                          <Fieldset label="Color preference"><Input value={c.colorPreference} onChange={(e) => setCake(i, "colorPreference", e.target.value.toUpperCase())} /></Fieldset>
                          <Fieldset label="Design description" className="sm:col-span-2"><Textarea value={c.designDescription} onChange={(e) => setCake(i, "designDescription", e.target.value.toUpperCase())} /></Fieldset>
                          <Fieldset label="Special instructions" className="sm:col-span-2"><Textarea value={c.specialInstructions} onChange={(e) => setCake(i, "specialInstructions", e.target.value.toUpperCase())} /></Fieldset>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button type="button" variant="outline" size="sm" onClick={addCake}>
                    <Plus size={16} /> Add another cake
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {section === "delivery" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Fieldset label="Required date" required>
              <Input type="date" value={String(v.requiredDate)} onChange={(e) => set("requiredDate", e.target.value)} />
            </Fieldset>
            <Fieldset label="Required time" required>
              <TimePicker12 value={String(v.requiredTime)} onChange={(val) => set("requiredTime", val)} />
            </Fieldset>
            <Fieldset label="Delivery type" className="sm:col-span-2">
              <div className="flex gap-2">
                {DELIVERY_TYPES.map((o) => (
                  <button key={o} type="button" onClick={() => set("deliveryType", o)}
                    className={cn("flex-1 rounded-xl border py-2.5 text-sm uppercase", v.deliveryType === o ? "border-brand bg-brand text-white" : "border-black/10 bg-white")}>
                    {DELIVERY_TYPE_LABEL[o]}
                  </button>
                ))}
              </div>
            </Fieldset>
            {v.deliveryType === "HOME_DELIVERY" && (
              <>
                <Fieldset label="Delivery address" required className="sm:col-span-2">
                  <Textarea value={String(v.deliveryAddress)} onChange={(e) => set("deliveryAddress", e.target.value.toUpperCase())} placeholder="Leave blank to use customer address" />
                </Fieldset>
                <Fieldset label="Delivery person"><Input value={String(v.deliveryPerson)} onChange={(e) => set("deliveryPerson", e.target.value.toUpperCase())} /></Fieldset>
              </>
            )}
            <Fieldset label="Priority">
              <Select value={String(v.priority)} onChange={(e) => set("priority", e.target.value)}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </Select>
            </Fieldset>
          </div>
        )}

        {section === "pricing" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Fieldset label="Products subtotal" className="sm:col-span-2">
              <div className="rounded-xl border border-black/10 bg-muted/40 px-3 py-2 text-sm">
                {includedCakes.map((c, i) => (
                  <div key={`cake-${i}`} className="flex justify-between gap-3">
                    <span className="text-foreground/60">{c.cakeCategory} · {c.cakeFlavor} · {c.cakeWeight}</span>
                    <span className="whitespace-nowrap">{inr(Number(c.price))}</span>
                  </div>
                ))}
                {includedItems.map((it, i) => (
                  <div key={`item-${i}`} className="flex justify-between gap-3">
                    <span className="text-foreground/60">{it.name} · {bakeQty(it.quantity, it.unit)}</span>
                    <span className="whitespace-nowrap">{inr(Number(it.price))}</span>
                  </div>
                ))}
                {includedCakes.length + includedItems.length === 0 && (
                  <span className="text-foreground/50">Nothing added yet — add cakes or items in the Orders tab.</span>
                )}
                {includedCakes.length + includedItems.length > 1 && (
                  <div className="mt-1 flex justify-between border-t border-black/10 pt-1 font-semibold">
                    <span>Subtotal</span>
                    <span>{inr(productSubtotal)}</span>
                  </div>
                )}
              </div>
            </Fieldset>
            <Fieldset label="Discount (₹)"><Input type="number" placeholder="0" value={String(v.discount)} onChange={(e) => set("discount", e.target.value)} /></Fieldset>
            <Fieldset label="Advance paid (₹)"><Input type="number" placeholder="0" value={String(v.advancePaid)} onChange={(e) => set("advancePaid", e.target.value)} /></Fieldset>
            <Fieldset label="Payment mode">
              <Select value={String(v.paymentMode)} onChange={(e) => set("paymentMode", e.target.value)}>
                {PAYMENT_MODES.map((p) => <option key={p} value={p}>{PAYMENT_MODE_LABEL[p]}</option>)}
              </Select>
            </Fieldset>

            <button
              type="button"
              onClick={() => { if (showMorePricing && pricingExtraDirty) return; setShowMorePricing((s) => !s); }}
              disabled={showMorePricing && pricingExtraDirty}
              title={showMorePricing && pricingExtraDirty ? "Clear the fields below to collapse" : undefined}
              className={cn(
                "sm:col-span-2 flex items-center gap-1.5 text-sm font-medium text-brand-dark",
                showMorePricing && pricingExtraDirty && "opacity-50"
              )}
            >
              <ChevronDown size={16} className={cn("transition-transform", showMorePricing && "rotate-180")} />
              {showMorePricing ? "Show less" : "Show more"}
              {showMorePricing && pricingExtraDirty && (
                <span className="text-xs font-normal text-foreground/40">· clear fields to collapse</span>
              )}
            </button>

            {showMorePricing && (
              <>
                <Fieldset label="Extra design charge (₹)"><Input type="number" placeholder="0" value={String(v.extraCharge)} onChange={(e) => set("extraCharge", e.target.value)} /></Fieldset>
                <Fieldset label="Delivery charge (₹)"><Input type="number" placeholder="0" value={String(v.deliveryCharge)} onChange={(e) => set("deliveryCharge", e.target.value)} /></Fieldset>
                <Fieldset label="Tax (₹)"><Input type="number" placeholder="0" value={String(v.tax)} onChange={(e) => set("tax", e.target.value)} /></Fieldset>
                <Fieldset label="Payment reference"><Input value={String(v.paymentRef)} onChange={(e) => set("paymentRef", e.target.value.toUpperCase())} /></Fieldset>
                <Fieldset label="Billing notes" className="sm:col-span-2"><Input value={String(v.billingNotes)} onChange={(e) => set("billingNotes", e.target.value.toUpperCase())} /></Fieldset>
              </>
            )}

            <div className="sm:col-span-2 rounded-xl bg-muted/60 p-3 text-sm">
              <div className="flex justify-between"><span>Total amount</span><span className="font-bold">{inr(totals.total)}</span></div>
              <div className="flex justify-between text-rose-600"><span>Balance</span><span className="font-bold">{inr(totals.balance)}</span></div>
            </div>
          </div>
        )}

        {section === "confirm" && (
          <div className="space-y-3 text-sm">
            <h3 className="font-bold text-brand-dark">Order summary</h3>
            <Row label="Customer" value={`${v.customerName} · ${v.phone}`} />
            {includedCakes.map((c, i) => (
              <SummaryItem
                key={`c${i}`}
                label={includedCakes.length > 1 ? `Cake ${i + 1}` : "Cake"}
                desc={[c.cakeCategory, c.cakeFlavor, c.cakeWeight, c.eggOption === "EGG" ? "With egg" : "Eggless"].filter(Boolean).join(" · ")}
                price={inr(Number(c.price))}
                note={c.cakeMessage.trim() || undefined}
              />
            ))}
            {includedItems.map((it, i) => (
              <SummaryItem
                key={`i${i}`}
                label={includedItems.length > 1 ? `Item ${i + 1}` : "Fresh Bakes"}
                desc={`${it.name} · ${bakeQty(it.quantity, it.unit)}`}
                price={inr(Number(it.price))}
                note={it.notes.trim() || undefined}
              />
            ))}
            <Row label="Required" value={`${ddmmyyyy(String(v.requiredDate))}${weekday(String(v.requiredDate)) ? ` (${weekday(String(v.requiredDate))})` : ""} at ${to12h(String(v.requiredTime))}`} />
            <Row label="Delivery" value={DELIVERY_TYPE_LABEL[String(v.deliveryType)]} />
            <div className="rounded-xl bg-muted/60 p-3">
              {hasProducts && (n("extraCharge") > 0 || n("deliveryCharge") > 0 || n("tax") > 0 || n("discount") > 0) && (
                <Row label="Subtotal" value={inr(productSubtotal)} />
              )}
              {hasProducts && n("extraCharge") > 0 && <Row label="Extra charge" value={inr(n("extraCharge"))} />}
              {hasProducts && n("deliveryCharge") > 0 && <Row label="Delivery charge" value={inr(n("deliveryCharge"))} />}
              {hasProducts && n("tax") > 0 && <Row label="Tax" value={inr(n("tax"))} />}
              {hasProducts && n("discount") > 0 && <Row label="Discount" value={`- ${inr(n("discount"))}`} />}
              <Row label="Total amount" value={inr(totals.total)} bold />
              {n("advancePaid") > 0 && <Row label="Advance paid" value={inr(n("advancePaid"))} />}
              <Row label="Balance" value={inr(totals.balance)} bold danger />
            </div>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-600">{error}</p>}
          </div>
        )}

      </div>

      {error && section !== "confirm" && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      {/* Fixed action bar — always pinned to the bottom, with Next or Save. */}
      <div className="no-print fixed inset-x-0 bottom-14 z-30 border-t border-black/5 bg-card/95 px-3 py-3 backdrop-blur md:bottom-0 md:pl-64">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div className="text-sm">
            <span className="text-foreground/50">Total </span>
            <span className="font-bold">{inr(totals.total)}</span>
            <span className="ml-2 text-rose-600">Bal {inr(totals.balance)}</span>
          </div>
          {isLastSection ? (
            <Button onClick={submit} disabled={pending} size="lg">
              {pending ? "Saving…" : mode === "create" ? "Save order" : "Update order"}
            </Button>
          ) : (
            <Button onClick={goNext} size="lg">Next</Button>
          )}
        </div>
      </div>
    </div>
  );
}

// 12-hour time picker (hour / minute / AM-PM) that emits a 24h "HH:mm" string.
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
      {/* No default time: until an hour is chosen the field stays empty so staff must set it deliberately */}
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

function Row({ label, value, bold, danger }: { label: string; value: string; bold?: boolean; danger?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-foreground/50">{label}</span>
      <span className={cn("text-right", bold && "font-bold", danger && "text-rose-600")}>{value}</span>
    </div>
  );
}

// A confirm-summary line for a cake / item: label and price share the top row
// (price in its own right column), with the full description and any message on
// their own lines so nothing gets cramped on a narrow screen.
function SummaryItem({ label, desc, price, note }: { label: string; desc: string; price?: string; note?: string }) {
  return (
    <div className="py-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-foreground/50">{label}</span>
        {price && <span className="font-semibold">{price}</span>}
      </div>
      <p className="text-foreground/90">{desc}</p>
      {note && <p className="text-xs italic text-foreground/50">“{note}”</p>}
    </div>
  );
}
