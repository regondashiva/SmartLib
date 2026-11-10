import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-6 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white via-white to-[#EEF5FF]/80 px-5 py-4 shadow-[0_2px_12px_rgba(15,23,42,0.03)] sm:px-6 sm:py-5",
        className
      )}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 text-slate-400" />}
              {crumb.to ? (
                <Link
                  to={crumb.to}
                  className="transition-colors hover:text-[#2563EB]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-[#2563EB]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Title row */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold tracking-tight text-[#0F172A] sm:text-2xl">
            {title}
          </h1>
          <div className="mt-1 h-1 w-12 rounded-full bg-gradient-to-r from-[#2563EB] to-[#38BDF8]" />
          {description && (
            <p className="mt-1.5 text-xs text-slate-600 sm:text-sm">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
