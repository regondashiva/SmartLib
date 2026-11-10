import { Badge } from "@/components/ui/badge";
import type { ItemStatus, MemberStatus, LoanStatus } from "@/types";

type StatusVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "rfid" | "rfid-muted";

function getItemStatusConfig(status: ItemStatus): { label: string; variant: StatusVariant } {
  const map: Record<ItemStatus, { label: string; variant: StatusVariant }> = {
    AVAILABLE: { label: "Available", variant: "success" },
    ISSUED: { label: "Issued", variant: "default" },
    RESERVED: { label: "Reserved", variant: "warning" },
    LOST: { label: "Lost", variant: "destructive" },
    DAMAGED: { label: "Damaged", variant: "destructive" },
    IN_TRANSIT: { label: "In Transit", variant: "secondary" },
    REFERENCE_ONLY: { label: "Reference Only", variant: "outline" },
    BINDING: { label: "Binding", variant: "secondary" },
  };
  return map[status] ?? { label: status, variant: "secondary" };
}

function getMemberStatusConfig(status: MemberStatus): { label: string; variant: StatusVariant } {
  const map: Record<MemberStatus, { label: string; variant: StatusVariant }> = {
    ACTIVE: { label: "Active", variant: "success" },
    BLOCKED: { label: "Blocked", variant: "destructive" },
    EXPIRED: { label: "Expired", variant: "warning" },
    SUSPENDED: { label: "Suspended", variant: "warning" },
  };
  return map[status] ?? { label: status, variant: "secondary" };
}

function getLoanStatusConfig(status: LoanStatus): { label: string; variant: StatusVariant } {
  const map: Record<LoanStatus, { label: string; variant: StatusVariant }> = {
    ACTIVE: { label: "Active", variant: "default" },
    RETURNED: { label: "Returned", variant: "success" },
    OVERDUE: { label: "Overdue", variant: "destructive" },
    LOST_CLAIMED: { label: "Lost", variant: "destructive" },
  };
  return map[status] ?? { label: status, variant: "secondary" };
}

export function ItemStatusBadge({ status }: { status: ItemStatus }) {
  const { label, variant } = getItemStatusConfig(status);
  return <Badge variant={variant}>{label}</Badge>;
}

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  const { label, variant } = getMemberStatusConfig(status);
  return <Badge variant={variant}>{label}</Badge>;
}

export function LoanStatusBadge({ status }: { status: LoanStatus }) {
  const { label, variant } = getLoanStatusConfig(status);
  return <Badge variant={variant}>{label}</Badge>;
}

