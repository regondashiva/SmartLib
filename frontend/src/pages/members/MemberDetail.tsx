import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, User, CreditCard, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberStatusBadge, LoanStatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatDate, formatCurrency } from "@/lib/utils";
import type { ApiResponse, Member, Loan } from "@/types";

export default function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["members", id],
    queryFn: () => apiGet<ApiResponse<Member & { loans?: Loan[] }>>(`/members/${id}`),
    enabled: !!id,
  });

  const member = data?.data;

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (isError || !member) {
    return <ErrorState onRetry={() => refetch()} title="Member not found" />;
  }

  return (
    <div>
      <PageHeader
        title={member.name}
        description={`Membership ID: ${member.membershipNumber}`}
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: "Members", to: "/members" },
          { label: member.name },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/members">
              <ArrowLeft className="size-4" />
              Back to Members
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="size-4" />
              Profile Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd><MemberStatusBadge status={member.status} /></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Type</dt>
                <dd><Badge variant="outline">{member.memberType}</Badge></dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{member.email ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">{member.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Department</dt>
                <dd className="font-medium">{member.department ?? "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Smart Card RFID UID</dt>
                <dd className="identifier">{member.rfidCardUid ?? "Not Assigned"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Expiry Date</dt>
                <dd className="font-medium">{member.expiryDate ? formatDate(member.expiryDate) : "—"}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-4" />
              Borrowing & Financial Standing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Borrowing Limit</p>
                <p className="text-xl font-semibold mt-1 tabular-nums">{member.borrowingLimit} books</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Current Active Loans</p>
                <p className="text-xl font-semibold mt-1 tabular-nums">{member.currentLoans ?? 0}</p>
              </div>
            </div>

            <div className="rounded-md border p-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Pending Fines</p>
                  <p className="text-lg font-semibold tabular-nums text-foreground mt-0.5">
                    {formatCurrency(member.pendingFines ?? 0)}
                  </p>
                </div>
                {(member.pendingFines ?? 0) > 0 && (
                  <Badge variant="destructive">Dues Outstanding</Badge>
                )}
              </div>
            </div>

            {member.status === "BLOCKED" && (
              <div className="mt-4 flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
                <ShieldAlert className="size-4 shrink-0" />
                <span>This member is currently blocked from borrowing new items.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Circulation History & Active Loans</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!member.loans || member.loans.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No active loans or loan records.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Book Copy / Accession</TableHead>
                    <TableHead>Issued Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Renewals</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {member.loans.map((loan) => (
                    <TableRow key={loan.id}>
                      <TableCell className="font-medium">
                        {loan.item?.accessionNumber ?? loan.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(loan.issuedDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(loan.dueDate)}</TableCell>
                      <TableCell><LoanStatusBadge status={loan.status} /></TableCell>
                      <TableCell className="text-right tabular-nums">{loan.renewalCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

