"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ReceiptActions() {
  return (
    <div className="no-print flex justify-end">
      <Button size="sm" onClick={() => window.print()}>
        <Printer size={16} /> Print / Save PDF
      </Button>
    </div>
  );
}
