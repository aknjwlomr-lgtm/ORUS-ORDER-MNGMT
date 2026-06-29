import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-dark shadow-sm shadow-brand/20",
        accent: "bg-accent text-brand-dark hover:opacity-90 shadow-sm",
        outline: "border border-brand/30 bg-white text-brand hover:bg-muted",
        ghost: "text-foreground/70 hover:bg-muted",
        danger: "bg-rose-500 text-white hover:bg-rose-600",
        success: "bg-emerald-600 text-white hover:bg-emerald-700",
        soft: "bg-muted text-foreground hover:bg-brand/10",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { buttonVariants };
