"use client";

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { inr } from "@/lib/utils";

const PIE_COLORS = ["#b00d28", "#c4a049", "#860a1f", "#e0577a", "#7a0b1e", "#d4af6a", "#eaa7b8"];
const STATUS_COLORS: Record<string, string> = {
  Active: "#c4a049",
  Completed: "#1e9e6a",
  Cancelled: "#b00d28",
};

const GRID = "#f0e6e8";
const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid rgba(0,0,0,0.06)",
  fontSize: 12,
  boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
} as const;

/** ₹ axis ticks in compact form, e.g. ₹12.5K, ₹1.2L. */
const compactInr = (n: number) =>
  "₹" + new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);

type NV = { name: string; value: number };
type TrendPoint = { label: string; revenue: number; orders: number };

function ChartCard({ title, empty, children }: { title: string; empty?: boolean; children: React.ReactElement }) {
  return (
    <div className="rounded-2xl border border-black/5 bg-card p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-brand-dark">{title}</h3>
      <div className="h-64 w-full">
        {empty ? (
          <div className="flex h-full items-center justify-center text-sm text-foreground/35">No data for this period</div>
        ) : (
          <ResponsiveContainer>{children}</ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function ReportCharts({
  trend,
  status,
  category,
  paymentMode,
}: {
  trend: TrendPoint[];
  status: NV[];
  category: NV[];
  paymentMode: NV[];
}) {
  const noRevenue = trend.every((t) => t.revenue === 0);
  const noOrders = trend.every((t) => t.orders === 0);
  const noStatus = status.every((s) => s.value === 0);

  return (
    <div className="mt-4 space-y-4">
      <ChartCard title="Revenue trend" empty={noRevenue}>
        <AreaChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b00d28" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#b00d28" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis fontSize={11} tickLine={false} axisLine={false} width={52} tickFormatter={compactInr} />
          <Tooltip formatter={(v) => [inr(Number(v)), "Revenue"]} contentStyle={tooltipStyle} />
          <Area type="monotone" dataKey="revenue" stroke="#b00d28" strokeWidth={2} fill="url(#revFill)" />
        </AreaChart>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Orders placed" empty={noOrders}>
          <BarChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} width={28} />
            <Tooltip formatter={(v) => [v, "Orders"]} contentStyle={tooltipStyle} />
            <Bar dataKey="orders" fill="#c4a049" radius={[5, 5, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Orders by status" empty={noStatus}>
          <PieChart>
            <Pie data={status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2}>
              {status.map((s) => <Cell key={s.name} fill={STATUS_COLORS[s.name] ?? "#999"} />)}
            </Pie>
            <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ChartCard>

        <ChartCard title="Top cake categories" empty={category.length === 0}>
          <BarChart data={category} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis type="number" allowDecimals={false} fontSize={11} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="name" fontSize={11} width={110} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => [v, "Orders"]} contentStyle={tooltipStyle} />
            <Bar dataKey="value" fill="#b00d28" radius={[0, 5, 5, 0]} maxBarSize={22} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Payment collection by mode" empty={paymentMode.length === 0}>
          <PieChart>
            <Pie data={paymentMode} dataKey="value" nameKey="name" innerRadius={50} outerRadius={82} paddingAngle={2}>
              {paymentMode.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Legend verticalAlign="bottom" height={24} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => inr(Number(v))} contentStyle={tooltipStyle} />
          </PieChart>
        </ChartCard>
      </div>
    </div>
  );
}
