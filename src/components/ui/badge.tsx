import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_COLOR,
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_COLOR,
  PAYMENT_STATUS_LABEL,
} from "@/lib/constants";

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={ORDER_STATUS_COLOR[status] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
      {ORDER_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={PAYMENT_STATUS_COLOR[status] ?? "bg-slate-100 text-slate-700 border-slate-200"}>
      {PAYMENT_STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
