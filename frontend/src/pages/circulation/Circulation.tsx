import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  Check,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  RefreshCw,
  RotateCcw,
  IndianRupee,
  Clock,
  CheckCircle2,
  XCircle,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { apiGet, apiPost } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type {
  PaginatedResponse,
  CirculationItem,
  Fine,
  IssueRequest,
  ReturnRequest,
  RenewRequest,
  PayFineRequest,
  WaiveFineRequest,
} from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ACTIVE: { label: "Active", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    RETURNED: { label: "Returned", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    LOST_CLAIMED: { label: "Lost", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function FineBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    UNPAID: { label: "Unpaid", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    PARTIALLY_PAID: { label: "Partial", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    PAID: { label: "Paid", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    WAIVED: { label: "Waived", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

function AlertBanner({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  const isSuccess = type === "success";
  return (
    <div
      className={`flex items-start gap-2 rounded-md p-3 text-sm mb-4 ${
        isSuccess
          ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
          : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
      ) : (
        <XCircle className="size-4 shrink-0 mt-0.5" />
      )}
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="ml-2 text-current opacity-70 hover:opacity-100">
        ×
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type ActiveTab = "loans" | "fines";

export default function CirculationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const [activeTab, setActiveTab] = useState<ActiveTab>("loans");
  const [loanPage, setLoanPage] = useState(1);
  const [finePage, setFinePage] = useState(1);

  // Global banner
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Issue form
  const [memberId, setMemberId] = useState("");
  const [bookItemId, setBookItemId] = useState("");

  // Renew dialog
  const [renewLoan, setRenewLoan] = useState<CirculationItem | null>(null);

  // Return dialog
  const [returnLoan, setReturnLoan] = useState<CirculationItem | null>(null);
  const [returnNotes, setReturnNotes] = useState("");

  // Pay fine dialog
  const [payFine, setPayFine] = useState<Fine | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "CARD" | "UPI" | "ONLINE">("CASH");

  // Waive fine dialog
  const [waiveFine, setWaiveFine] = useState<Fine | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  const showBanner = useCallback((type: "success" | "error", message: string) => {
    setBanner({ type, message });
    if (type === "success") setTimeout(() => setBanner(null), 6000);
  }, []);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["circulation"] });
    queryClient.invalidateQueries({ queryKey: ["fines"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
  }, [queryClient]);

  // ─── Queries ────────────────────────────────────────────────────────────────

  const loansQuery = useQuery({
    queryKey: ["circulation", "list", loanPage],
    queryFn: () =>
      apiGet<PaginatedResponse<CirculationItem>>("/circulation", { page: loanPage, limit: 15 }),
    staleTime: 30_000,
  });

  const finesQuery = useQuery({
    queryKey: ["fines", "list", finePage],
    queryFn: () =>
      apiGet<PaginatedResponse<Fine>>("/circulation/fines", { page: finePage, limit: 20 }),
    staleTime: 30_000,
    enabled: activeTab === "fines",
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  const issueMutation = useMutation({
    mutationFn: (req: IssueRequest) => apiPost("/circulation/issue", req),
    onSuccess: () => {
      setMemberId("");
      setBookItemId("");
      showBanner("success", "✓ Book issued successfully. EAS security tag has been disarmed.");
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Failed to issue book. Check member status and copy availability.";
      showBanner("error", msg);
    },
  });

  const renewMutation = useMutation({
    mutationFn: (req: RenewRequest) => apiPost("/circulation/renew", req),
    onSuccess: () => {
      setRenewLoan(null);
      showBanner("success", "✓ Loan renewed successfully. Due date has been extended.");
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Failed to renew loan.";
      showBanner("error", msg);
    },
  });

  const returnMutation = useMutation({
    mutationFn: (req: ReturnRequest) => apiPost("/circulation/return", req),
    onSuccess: (data: unknown) => {
      setReturnLoan(null);
      setReturnNotes("");
      const res = data as { fine?: { amount: number } | null };
      const fineMsg = res?.fine?.amount
        ? ` A fine of ${formatCurrency(res.fine.amount)} has been assessed.`
        : "";
      showBanner("success", `✓ Book returned. EAS tag re-armed.${fineMsg}`);
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Failed to process return.";
      showBanner("error", msg);
    },
  });

  const payFineMutation = useMutation({
    mutationFn: (req: PayFineRequest) => apiPost("/circulation/fines/pay", req),
    onSuccess: (data: unknown) => {
      setPayFine(null);
      setPayAmount("");
      const res = data as { message?: string };
      showBanner("success", res?.message ?? "✓ Fine payment recorded.");
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Failed to process payment.";
      showBanner("error", msg);
    },
  });

  const waiveFineMutation = useMutation({
    mutationFn: (req: WaiveFineRequest) => apiPost("/circulation/fines/waive", req),
    onSuccess: (data: unknown) => {
      setWaiveFine(null);
      setWaiveReason("");
      const res = data as { message?: string };
      showBanner("success", res?.message ?? "✓ Fine waived.");
      invalidateAll();
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Failed to waive fine.";
      showBanner("error", msg);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberId.trim() || !bookItemId.trim()) return;
    issueMutation.mutate({ memberId: memberId.trim(), bookItemId: bookItemId.trim() });
  };

  const handleReturn = () => {
    if (!returnLoan) return;
    returnMutation.mutate({ circulationId: returnLoan.id, notes: returnNotes || undefined });
  };

  const handleRenew = () => {
    if (!renewLoan) return;
    renewMutation.mutate({ circulationId: renewLoan.id });
  };

  const handlePayFine = () => {
    if (!payFine) return;
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount <= 0) {
      showBanner("error", "Enter a valid payment amount.");
      return;
    }
    payFineMutation.mutate({ fineId: payFine.id, amount, paymentMethod: payMethod });
  };

  const handleWaiveFine = () => {
    if (!waiveFine || !waiveReason.trim()) return;
    waiveFineMutation.mutate({ fineId: waiveFine.id, reason: waiveReason.trim() });
  };

  // ─── Pagination data ─────────────────────────────────────────────────────────

  const loans = loansQuery.data?.data ?? [];
  const loanMeta = loansQuery.data?.pagination;
  const fines = finesQuery.data?.data ?? [];
  const fineMeta = finesQuery.data?.pagination;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Circulation"
        description="Book check-out, returns, renewals and fine management"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Circulation" }]}
      />

      {banner && (
        <AlertBanner
          type={banner.type}
          message={banner.message}
          onDismiss={() => setBanner(null)}
        />
      )}

      {/* Top Row: Issue Panel + Policies */}
      <div className="grid gap-6 lg:grid-cols-3 mb-6">
        {/* Issue Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="size-4 text-primary" />
              Issue Book (Check-Out)
            </CardTitle>
            <CardDescription>Assign physical copy to member account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleIssue} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Member UUID</label>
                <Input
                  placeholder="Member ID (UUID)…"
                  value={memberId}
                  onChange={(e) => setMemberId(e.target.value)}
                  disabled={issueMutation.isPending}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Book Copy UUID</label>
                <Input
                  placeholder="BookItem ID (UUID)…"
                  value={bookItemId}
                  onChange={(e) => setBookItemId(e.target.value)}
                  disabled={issueMutation.isPending}
                />
              </div>
              <Button
                type="submit"
                disabled={issueMutation.isPending || !memberId.trim() || !bookItemId.trim()}
                className="w-full mt-1"
              >
                {issueMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Processing…
                  </>
                ) : (
                  "Confirm Issue"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Policies */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Circulation Policy</CardTitle>
            <CardDescription>Institutional rules enforced automatically</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 text-xs text-muted-foreground">
            <div className="rounded-lg border p-3">
              <p className="font-semibold text-foreground mb-1">Member Eligibility</p>
              <p>Member must be ACTIVE. Blocked / expired members and those with fines ≥ ₹25 are automatically rejected.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold text-foreground mb-1">Item Availability</p>
              <p>Reference-only items cannot circulate. Only AVAILABLE copies may be checked out.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold text-foreground mb-1">Borrowing Quota</p>
              <p>Faculty: 10 books / 30 days. Others: 5 books / 14 days. Max 2 renewals per loan.</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="font-semibold text-foreground mb-1">Overdue Fines</p>
              <p>₹5 per overdue day. Fines are assessed automatically on return and recorded against the member.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 border-b mb-4">
        {(["loans", "fines"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "loans" ? "Active Loans Ledger" : "Fine Management"}
          </button>
        ))}
      </div>

      {/* ── LOANS TAB ── */}
      {activeTab === "loans" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Active Loans Ledger</CardTitle>
              <CardDescription>All circulation transactions — click Renew or Return to act</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => loansQuery.refetch()}>
              <RefreshCw className="size-3.5 mr-1" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {loansQuery.isError ? (
              <ErrorState onRetry={() => loansQuery.refetch()} />
            ) : loansQuery.isLoading ? (
              <div className="p-4 flex flex-col gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : loans.length === 0 ? (
              <EmptyState
                icon={ArrowLeftRight}
                title="No loans found"
                message="No circulation records match the current filter."
              />
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap pl-5">Member</TableHead>
                      <TableHead className="whitespace-nowrap">Book / Accession</TableHead>
                      <TableHead className="whitespace-nowrap">Issued</TableHead>
                      <TableHead className="whitespace-nowrap">Due Date</TableHead>
                      <TableHead className="whitespace-nowrap text-center">Renewals</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap pr-5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((loan) => {
                      const overdue = isOverdue(loan.dueDate) && loan.status === "ACTIVE";
                      const canAct = loan.status === "ACTIVE" || loan.status === "OVERDUE";
                      return (
                        <TableRow key={loan.id} className={overdue ? "bg-red-50/40 dark:bg-red-900/10" : ""}>
                          <TableCell className="min-w-[140px] pl-5">
                            <p className="font-medium text-sm">{loan.member.name}</p>
                            <p className="text-xs text-muted-foreground identifier">{loan.member.cardNumber}</p>
                          </TableCell>
                          <TableCell className="min-w-[180px] max-w-[240px]">
                            <p className="font-medium text-sm truncate" title={loan.item.title}>{loan.item.title}</p>
                            <p className="text-xs text-muted-foreground identifier">{loan.item.accessionNumber}</p>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDateTime(loan.issuedDate)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className={`text-xs font-medium ${overdue ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                              {overdue && <Clock className="inline size-3 mr-1" />}
                              {formatDateTime(loan.dueDate)}
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-center">
                            <Badge variant="outline">{loan.renewalCount}/2</Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <StatusBadge status={overdue ? "OVERDUE" : loan.status} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap pr-5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={!canAct || loan.renewalCount >= 2 || renewMutation.isPending}
                                onClick={() => setRenewLoan(loan)}
                                title={loan.renewalCount >= 2 ? "Max renewals reached" : "Renew loan"}
                              >
                                <RefreshCw className="size-3 mr-1" />
                                Renew
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-green-700 dark:text-green-400"
                                disabled={!canAct || returnMutation.isPending}
                                onClick={() => { setReturnLoan(loan); setReturnNotes(""); }}
                              >
                                <RotateCcw className="size-3 mr-1" />
                                Return
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── FINES TAB ── */}
      {activeTab === "fines" && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Fine Management</CardTitle>
              <CardDescription>Collect payments, issue receipts, and waive fines</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => finesQuery.refetch()}>
              <RefreshCw className="size-3.5 mr-1" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {finesQuery.isError ? (
              <ErrorState onRetry={() => finesQuery.refetch()} />
            ) : finesQuery.isLoading ? (
              <div className="p-4 flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : fines.length === 0 ? (
              <EmptyState
                icon={IndianRupee}
                title="No fines"
                message="No fine records found in the system."
              />
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap pl-5">Member</TableHead>
                      <TableHead className="whitespace-nowrap">Book</TableHead>
                      <TableHead className="whitespace-nowrap">Reason</TableHead>
                      <TableHead className="whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Balance</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap pr-5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fines.map((fine) => (
                      <TableRow key={fine.id}>
                        <TableCell className="min-w-[140px] pl-5">
                          <p className="font-medium text-sm">{fine.member?.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground identifier">{fine.member?.cardNumber}</p>
                        </TableCell>
                        <TableCell className="min-w-[180px] max-w-[240px]">
                          <p className="text-sm truncate" title={fine.circulation?.bookTitle}>
                            {fine.circulation?.bookTitle ?? "—"}
                          </p>
                          <p className="text-xs text-muted-foreground identifier">
                            {fine.circulation?.accessionNumber}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs capitalize">
                          {fine.reason.replace(/_/g, " ").toLowerCase()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-medium">
                          {formatCurrency(fine.amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(fine.balance)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <FineBadge status={fine.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-5 text-right">
                          <div className="flex justify-end gap-1.5">
                            {fine.status !== "PAID" && fine.status !== "WAIVED" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => { setPayFine(fine); setPayAmount(fine.balance.toFixed(2)); }}
                                >
                                  <Receipt className="size-3 mr-1" />
                                  Pay
                                </Button>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs text-purple-600 dark:text-purple-400"
                                    onClick={() => { setWaiveFine(fine); setWaiveReason(""); }}
                                  >
                                    Waive
                                  </Button>
                                )}
                              </>
                            )}
                            {fine.receiptNumber && (
                              <span className="text-xs text-muted-foreground identifier self-center">
                                {fine.receiptNumber}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {activeTab === "loans" && loanMeta && loanMeta.totalPages > 1 && (
        <Pagination
          page={loanPage}
          totalPages={loanMeta.totalPages}
          total={loanMeta.total}
          onPrev={() => setLoanPage((p) => p - 1)}
          onNext={() => setLoanPage((p) => p + 1)}
          label="loans"
        />
      )}
      {activeTab === "fines" && fineMeta && fineMeta.totalPages > 1 && (
        <Pagination
          page={finePage}
          totalPages={fineMeta.totalPages}
          total={fineMeta.total}
          onPrev={() => setFinePage((p) => p - 1)}
          onNext={() => setFinePage((p) => p + 1)}
          label="fine records"
        />
      )}

      {/* ── RENEW DIALOG ── */}
      <Dialog open={!!renewLoan} onOpenChange={(open: boolean) => { if (!open) setRenewLoan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renew Loan</DialogTitle>
            <DialogDescription>
              Extend the due date by {renewLoan?.member.memberType === "FACULTY" ? "30" : "14"} days.
            </DialogDescription>
          </DialogHeader>
          {renewLoan && (
            <div className="space-y-3 py-2 text-sm">
              <Detail label="Member" value={`${renewLoan.member.name} (${renewLoan.member.cardNumber})`} />
              <Detail label="Book" value={renewLoan.item.title} />
              <Detail label="Accession" value={renewLoan.item.accessionNumber} mono />
              <Detail label="Current Due" value={formatDateTime(renewLoan.dueDate)} />
              <Detail label="Renewals Used" value={`${renewLoan.renewalCount} / 2`} />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewLoan(null)}>Cancel</Button>
            <Button onClick={handleRenew} disabled={renewMutation.isPending}>
              {renewMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <RefreshCw className="size-4 mr-1" />}
              Confirm Renewal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RETURN DIALOG ── */}
      <Dialog open={!!returnLoan} onOpenChange={(open: boolean) => { if (!open) setReturnLoan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return Book</DialogTitle>
            <DialogDescription>
              Record check-in and re-arm the EAS security tag.
              {returnLoan && isOverdue(returnLoan.dueDate) && (
                <span className="text-red-500 font-medium"> This item is overdue — a fine will be calculated.</span>
              )}
            </DialogDescription>
          </DialogHeader>
          {returnLoan && (
            <div className="space-y-3 py-2 text-sm">
              <Detail label="Member" value={`${returnLoan.member.name} (${returnLoan.member.cardNumber})`} />
              <Detail label="Book" value={returnLoan.item.title} />
              <Detail label="Accession" value={returnLoan.item.accessionNumber} mono />
              <Detail label="Due Date" value={formatDateTime(returnLoan.dueDate)} />
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-xs font-medium text-foreground">Notes (optional)</label>
                <Input
                  placeholder="e.g. Minor cover damage"
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnLoan(null)}>Cancel</Button>
            <Button onClick={handleReturn} disabled={returnMutation.isPending} className="bg-green-600 hover:bg-green-700 text-white">
              {returnMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <Check className="size-4 mr-1" />}
              Confirm Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── PAY FINE DIALOG ── */}
      <Dialog open={!!payFine} onOpenChange={(open: boolean) => { if (!open) setPayFine(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Collect Fine Payment</DialogTitle>
            <DialogDescription>Record payment and issue a receipt.</DialogDescription>
          </DialogHeader>
          {payFine && (
            <div className="space-y-3 py-2 text-sm">
              <Detail label="Member" value={payFine.member?.name ?? "—"} />
              <Detail label="Total Fine" value={formatCurrency(payFine.amount)} />
              <Detail label="Paid So Far" value={formatCurrency(payFine.paidAmount)} />
              <Detail label="Balance Due" value={formatCurrency(payFine.balance)} highlight />
              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-xs font-medium text-foreground">Amount Collected (₹)</label>
                <Input
                  type="number"
                  min="0.01"
                  max={payFine.balance}
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder={`Max: ${payFine.balance.toFixed(2)}`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-foreground">Payment Method</label>
                <div className="flex gap-2 flex-wrap">
                  {(["CASH", "CARD", "UPI", "ONLINE"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`px-3 py-1 rounded-full border text-xs font-medium transition-colors ${
                        payMethod === m
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFine(null)}>Cancel</Button>
            <Button onClick={handlePayFine} disabled={payFineMutation.isPending}>
              {payFineMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <Receipt className="size-4 mr-1" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── WAIVE FINE DIALOG (Admin only) ── */}
      {isAdmin && (
        <Dialog open={!!waiveFine} onOpenChange={(open: boolean) => { if (!open) setWaiveFine(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Waive Fine</DialogTitle>
              <DialogDescription>
                Permanently waive this fine. Provide a mandatory reason for the audit log.
              </DialogDescription>
            </DialogHeader>
            {waiveFine && (
              <div className="space-y-3 py-2 text-sm">
                <Detail label="Member" value={waiveFine.member?.name ?? "—"} />
                <Detail label="Fine Balance" value={formatCurrency(waiveFine.balance)} highlight />
                <div className="flex flex-col gap-1.5 mt-2">
                  <label className="text-xs font-medium text-foreground">Waiver Reason (required)</label>
                  <Input
                    placeholder="e.g. Book recovered in excellent condition"
                    value={waiveReason}
                    onChange={(e) => setWaiveReason(e.target.value)}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setWaiveFine(null)}>Cancel</Button>
              <Button
                onClick={handleWaiveFine}
                disabled={waiveFineMutation.isPending || waiveReason.trim().length < 5}
                variant="destructive"
              >
                {waiveFineMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <XCircle className="size-4 mr-1" />}
                Confirm Waiver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Detail({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-right ${mono ? "identifier text-xs" : ""} ${highlight ? "text-red-600 dark:text-red-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  total,
  onPrev,
  onNext,
  label,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  label: string;
}) {
  return (
    <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {totalPages} ({total} {label})
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={onPrev}>
          <ArrowLeft className="size-3.5 mr-1" />
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={onNext}>
          Next
          <ArrowRight className="size-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function extractErrorMessage(err: unknown): string | null {
  if (err && typeof err === "object" && "response" in err) {
    const e = err as { response?: { data?: { message?: string } } };
    return e.response?.data?.message ?? null;
  }
  return null;
}
