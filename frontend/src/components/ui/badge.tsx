import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-blue-200 bg-blue-50 text-[#1D4ED8]",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        destructive: "border-rose-200 bg-rose-50 text-[#DC2626]",
        outline: "border-slate-200 text-slate-700 bg-white",
        success: "border-emerald-200 bg-emerald-100/80 text-emerald-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
        rfid: "border-transparent bg-[#0D9488] text-white",
        "rfid-muted": "border-teal-200 bg-teal-50 text-[#0D9488]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
