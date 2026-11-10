import * as React from "react";
import {
  Search,
  Filter,
  AlertCircle,
  Inbox,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * PrimaryButton & SecondaryButton
 */
export const PrimaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <Button ref={ref} variant="default" className={cn("font-semibold", className)} {...props} />
  )
);
PrimaryButton.displayName = "PrimaryButton";

export const SecondaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => (
    <Button ref={ref} variant="outline" className={cn("font-semibold", className)} {...props} />
  )
);
SecondaryButton.displayName = "SecondaryButton";

/**
 * StatusBadge generic wrapper
 */
export function StatusBadge({
  status,
  variant = "default",
  className,
}: {
  status: string;
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "rfid" | "rfid-muted";
  className?: string;
}) {
  return (
    <Badge variant={variant} className={className}>
      {status}
    </Badge>
  );
}

/**
 * SearchBar
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search records…",
  className,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
}) {
  return (
    <div className={cn("relative flex-1", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="pl-10"
      />
    </div>
  );
}

/**
 * FilterPanel
 */
export function FilterPanel({
  children,
  title,
  onReset,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  onReset?: () => void;
  className?: string;
}) {
  return (
    <Card className={cn("mb-5", className)}>
      <CardContent className="p-4 sm:p-5">
        {title && (
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
              <Filter className="size-3.5 text-[#2563EB]" />
              <span>{title}</span>
            </div>
            {onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs font-semibold text-[#2563EB] hover:underline"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * FormSection
 */
export function FormSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="border-b border-slate-100 bg-slate-50/60 pb-4">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
              <Icon className="size-4" />
            </div>
          )}
          <div>
            <CardTitle className="text-sm font-bold text-[#0F172A]">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-0.5 text-xs text-slate-500">
                {description}
              </CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-5">{children}</CardContent>
    </Card>
  );
}

/**
 * ChartCard
 */
export function ChartCard({
  title,
  description,
  icon: Icon,
  headerRight,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ElementType;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            {Icon && (
              <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                <Icon className="size-4" />
              </div>
            )}
            <div>
              <CardTitle className="text-sm font-bold text-[#0F172A]">{title}</CardTitle>
              {description && (
                <CardDescription className="text-xs text-slate-500">
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {headerRight && <div className="shrink-0">{headerRight}</div>}
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-2">{children}</CardContent>
    </Card>
  );
}

/**
 * EmptyState, LoadingState, ErrorState
 */
export function EmptyState({
  title = "No records found",
  description = "Adjust your search or filter criteria to find matching records.",
  icon: Icon = Inbox,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon className="size-6" />
      </div>
      <h4 className="text-sm font-bold text-[#0F172A]">{title}</h4>
      <p className="mt-1 max-w-sm text-xs text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading institutional data…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Loader2 className="size-7 animate-spin text-[#2563EB]" />
      <p className="mt-2.5 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Unable to load data",
  message = "An error occurred while communicating with the server.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
      <AlertCircle className="size-8 text-[#DC2626]" />
      <h4 className="mt-2 text-sm font-bold text-[#0F172A]">{title}</h4>
      <p className="mt-1 max-w-md text-xs text-slate-600">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          Retry Request
        </Button>
      )}
    </div>
  );
}

/**
 * Pagination
 */
export function Pagination({
  page,
  totalPages,
  totalItems,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems?: number;
  onPageChange: (nextPage: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
      <span>
        Page <strong className="font-semibold text-[#0F172A]">{page}</strong> of{" "}
        <strong className="font-semibold text-[#0F172A]">{Math.max(1, totalPages)}</strong>
        {totalItems !== undefined && ` (${totalItems.toLocaleString()} total)`}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * ConfirmationDialog
 */
export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end gap-2.5 pt-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * DetailDrawer
 */
export function DetailDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close drawer">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

/**
 * DataTable
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading,
  emptyTitle,
  emptyDescription,
}: {
  columns: {
    header: string;
    accessor: (row: T) => React.ReactNode;
    className?: string;
  }[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (isLoading) {
    return <LoadingState />;
  }
  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} className={col.className}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={keyExtractor(row, idx)}>
              {columns.map((col, cIdx) => (
                <td key={cIdx} className={col.className}>
                  {col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

