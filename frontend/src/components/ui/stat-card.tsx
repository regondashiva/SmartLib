import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  iconColor?: string;
  trend?: { value: number; label?: string };
  subtitle?: string;
  variant?: "default" | "rfid" | "warning" | "danger" | "success" | "indigo" | "amber" | "sky";
  className?: string;
  valueClassName?: string;
}

const variantConfig = {
  default: {
    icon: "text-[#2563EB]",
    bg: "bg-blue-50/90 border border-blue-100/80",
  },
  rfid: {
    icon: "text-[#0D9488]",
    bg: "bg-teal-50/90 border border-teal-100/80",
  },
  warning: {
    icon: "text-[#F59E0B]",
    bg: "bg-amber-50/90 border border-amber-100/80",
  },
  danger: {
    icon: "text-[#DC2626]",
    bg: "bg-rose-50/90 border border-rose-100/80",
  },
  success: {
    icon: "text-[#16A34A]",
    bg: "bg-emerald-50/90 border border-emerald-100/80",
  },
  indigo: {
    icon: "text-indigo-600",
    bg: "bg-indigo-50/90 border border-indigo-100/80",
  },
  amber: {
    icon: "text-orange-500",
    bg: "bg-orange-50/90 border border-orange-100/80",
  },
  sky: {
    icon: "text-[#0284C7]",
    bg: "bg-sky-50/90 border border-sky-100/80",
  },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  subtitle,
  variant = "default",
  className,
  valueClassName,
}: StatCardProps) {
  const cfg = variantConfig[variant] ?? variantConfig.default;

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-slate-200/85 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.07)] transition-all duration-200",
        className
      )}
    >
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-3.5 sm:gap-4">
          {Icon && (
            <div
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-2xl",
                cfg.bg
              )}
            >
              <Icon className={cn("size-6", cfg.icon)} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-600">
              {label}
            </p>
            <p
              className={cn(
                "mt-0.5 text-2xl font-extrabold tabular-nums tracking-tight text-[#0F172A]",
                valueClassName
              )}
            >
              {value}
            </p>
            {trend !== undefined && (
              <div className="mt-0.5 flex items-center gap-1">
                {trend.value > 0 ? (
                  <TrendingUp className="size-3 text-[#16A34A]" />
                ) : trend.value < 0 ? (
                  <TrendingDown className="size-3 text-[#DC2626]" />
                ) : (
                  <Minus className="size-3 text-slate-400" />
                )}
                <span
                  className={cn(
                    "text-[11px] font-semibold",
                    trend.value > 0
                      ? "text-[#16A34A]"
                      : trend.value < 0
                        ? "text-[#DC2626]"
                        : "text-slate-500"
                  )}
                >
                  {trend.value > 0 ? "+" : ""}
                  {trend.value}% {trend.label ?? "vs last month"}
                </span>
              </div>
            )}
            {subtitle && !trend && (
              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
