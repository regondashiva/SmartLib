import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  RefreshCw,
  Shield,
  AlertCircle,
  Search,
  Clock,
  UserCheck,
  Database,
  Eye,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { PaginatedResponse, AuditLog } from "@/types";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit-logs", page],
    queryFn: () => apiGet<PaginatedResponse<AuditLog>>("/audit-logs", { page, limit: 25 }),
    staleTime: 30_000,
  });

  const logs = data?.data ?? [];
  const totalEvents = data?.pagination?.total ?? data?.meta?.total ?? logs.length;
  const totalPages = data?.pagination?.totalPages ?? data?.meta?.totalPages ?? 1;

  const actionsList = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (actionFilter !== "ALL" && l.action !== actionFilter) return false;
      if (dateFrom && l.createdAt && l.createdAt < dateFrom) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const actor = (l.user?.name || l.user?.email || l.userId || "").toLowerCase();
        const ent = (l.entity || "").toLowerCase();
        const act = (l.action || "").toLowerCase();
        if (!actor.includes(q) && !ent.includes(q) && !act.includes(q)) return false;
      }
      return true;
    });
  }, [logs, actionFilter, dateFrom, searchQuery]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Trail & Compliance Logs"
        description="Immutable chronological record of administrative actions, policy modifications, circulation events, and security incidents"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Audit Logs" }]}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className="size-3.5" />
            Refresh Trail
          </Button>
        }
      />

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Recorded Audit Events"
          value={isLoading ? "..." : totalEvents.toLocaleString()}
          icon={FileText}
          variant="default"
        />
        <StatCard
          label="Distinct Action Types"
          value={isLoading ? "..." : Math.max(actionsList.length, 1)}
          icon={Database}
          variant="indigo"
        />
        <StatCard
          label="Integrity Mode"
          value="Append-Only"
          icon={Shield}
          variant="success"
        />
        <StatCard
          label="Current Page Records"
          value={filteredLogs.length}
          icon={UserCheck}
          variant="rfid"
        />
      </div>

      {/* Search & Date Filter Bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[240px] flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by user, action, module or entity reference…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <select
            aria-label="Filter by audit action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700"
          >
            <option value="ALL">All Actions</option>
            {actionsList.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          <Input
            type="date"
            aria-label="Filter from date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40 text-xs"
          />

          {(searchQuery || actionFilter !== "ALL" || dateFrom) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setActionFilter("ALL");
                setDateFrom("");
              }}
            >
              Clear Filters
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 bg-slate-50/50 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[#0F172A]">
              <Shield className="size-4 text-[#2563EB]" />
              Compliance Activity Trail
            </CardTitle>
            <CardDescription>
              Security and database modifications recorded with authenticated actor identity
            </CardDescription>
          </div>
          <Badge variant="outline">Live Backend Connection</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap pl-5">Timestamp</TableHead>
                  <TableHead className="whitespace-nowrap">Action</TableHead>
                  <TableHead className="whitespace-nowrap">Module / Entity</TableHead>
                  <TableHead className="whitespace-nowrap">Actor / User</TableHead>
                  <TableHead className="whitespace-nowrap">IP Address</TableHead>
                  <TableHead className="whitespace-nowrap pr-5 text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6} className="h-11 animate-pulse bg-slate-50" />
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-[#DC2626]">
                      <AlertCircle className="mx-auto mb-1 size-5 text-[#DC2626]" />
                      Failed to fetch audit records. Ensure you are signed in as an ADMIN.
                    </TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-slate-500">
                      No matching audit records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-xs text-slate-600 pl-5">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3 text-slate-400" />
                          {formatDateTime(log.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="default" className="font-mono text-[10px]">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#0F172A] min-w-[140px]">
                        {log.entity
                          ? `${log.entity} ${log.entityId ? `(${log.entityId.slice(0, 8)})` : ""}`
                          : "System"}
                      </TableCell>
                      <TableCell className="text-xs min-w-[160px]">
                        {log.user ? (
                          <div>
                            <p className="font-bold text-[#0F172A]">{log.user.name}</p>
                            <p className="text-[11px] text-slate-500">{log.user.email}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">{log.userId ?? "System"}</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                        {log.ipAddress ?? "127.0.0.1"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-5 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="size-3.5" />
                        Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      </Card>

      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-5 py-3 text-xs text-slate-600 shadow-2xs">
          <span>
            Page <strong className="text-[#0F172A]">{page}</strong> of{" "}
            <strong className="text-[#0F172A]">{totalPages}</strong> (
            {totalEvents.toLocaleString()} total events)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Event Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Audit Event Payload</CardTitle>
                <Badge variant="default">{selectedLog.action}</Badge>
              </div>
              <CardDescription>
                Recorded at {formatDateTime(selectedLog.createdAt)} • Entity:{" "}
                {selectedLog.entity || "System"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-xs">
              <pre className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] text-slate-800">
                {JSON.stringify(selectedLog.details ?? selectedLog, null, 2)}
              </pre>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
