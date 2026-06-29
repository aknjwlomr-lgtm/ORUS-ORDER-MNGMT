"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = Record<string, string | number>;

export function ExportButton({ rows }: { rows: Row[] }) {
  function exportCsv() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const escape = (val: string | number) => {
      const s = String(val ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `alpha-bakery-orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button size="sm" variant="outline" onClick={exportCsv}>
      <Download size={16} /> Export CSV
    </Button>
  );
}
