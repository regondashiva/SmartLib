import { InboxIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title?: string;
  message?: string;
  description?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = "No results",
  message,
  description,
  icon: Icon = InboxIcon,
  actions,
  className,
}: EmptyStateProps) {
  const displayMessage = description || message || "No items found.";
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="max-w-xs">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{displayMessage}</p>
      </div>
      {actions && <div className="mt-1">{actions}</div>}
    </div>
  );
}

