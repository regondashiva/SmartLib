import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  BookOpen,
  AlertTriangle,
  Users,
  IndianRupee,
  Radio,
  ShieldAlert,
  UserCheck,
  Database,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { apiGet, apiDownload } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse, ReportCategoryKey, ReportFilterParams } from "@/types";

const CHART_COLORS = [
  "#2563EB",
  "#0D9488",
  "#D97706",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
  "#EF4444",
  "#64748B",
];

interface ReportTabMeta {
  key: ReportCategoryKey;
  label: string;
  endpoint: string;
  badge: string;
  description: string;
  icon: typeof BarChart3;
}

const REPORT_TABS: ReportTabMeta[] = [
  {
    key: "DASHBOARD",
    label: "Executive Overview",
    endpoint: "/reports/dashboard",
    badge: "Executive",
    description:
      "Consolidated institutional KPIs, circulation velocity, category breakdown, and inventory status.",
    icon: LayoutDashboard,
  },
  {
    key: "CIRCULATION",
    label: "Circulation Report",
    endpoint: "/reports/circulation",
    badge: "Operational",
    description:
      "Total issues, returns, active loans, renewals, daily/weekly/monthly trends, and most borrowed books.",
    icon: BookOpen,
  },
  {
    key: "OVERDUE",
    label: "Overdue Ledger",
    endpoint: "/reports/overdue",
    badge: "Delinquency",
    description:
      "Delinquent loans, accession numbers, elapsed overdue days, fine accruals, and role-gated patron contacts.",
    icon: AlertTriangle,
  },
  {
    key: "INVENTORY",
    label: "Inventory & Audit",
    endpoint: "/reports/inventory",
    badge: "Collection",
    description:
      "Total physical copies, available vs issued, RFID-tagged coverage, misplaced, missing, and uncatalogued scans.",
    icon: BarChart3,
  },
  {
    key: "MEMBERS",
    label: "Member Activity",
    endpoint: "/reports/members",
    badge: "Patrons",
    description:
      "Active, inactive, and blocked members, borrowing frequency, outstanding fines, and category distribution.",
    icon: Users,
  },
  {
    key: "FINES",
    label: "Fine Collection",
    endpoint: "/reports/fines",
    badge: "Financial",
    description:
      "Assessed penalties, collected revenue, outstanding balances, partial payments, and authorized waivers.",
    icon: IndianRupee,
  },
  {
    key: "RFID",
    label: "RFID Operations",
    endpoint: "/reports/rfid",
    badge: "Hardware",
    description:
      "Tagged items, EPC Gen2 encodings, EAS armed states, reader events, failed scans, and device availability.",
    icon: Radio,
  },
  {
    key: "SECURITY_GATES",
    label: "Security Gates",
    endpoint: "/reports/security-gates",
    badge: "Security",
    description:
      "Authorized vs unauthorized passages, EAS alarm triggers, gate identifiers, footfall counts, and CCTV refs.",
    icon: ShieldAlert,
  },
  {
    key: "OPERATORS",
    label: "Operator Activity",
    endpoint: "/reports/operators",
    badge: "Compliance",
    description:
      "Staff user activity, circulation operations, RFID actions, administrative changes, and audit events.",
    icon: UserCheck,
  },
  {
    key: "MIGRATIONS",
    label: "Migration Batches",
    endpoint: "/reports/migrations",
    badge: "Migration",
    description:
      "Uploaded legacy catalog batches, source row counts, valid/invalid/duplicate records, commits, and rollbacks.",
    icon: Database,
  },
];

export default function ReportsAnalyticsPage() {
  const [selectedTab, setSelectedTab] = useState<ReportCategoryKey>("CIRCULATION");

  // Form filter inputs (editable before clicking "Generate Report")
  const [draftFilters, setDraftFilters] = useState<ReportFilterParams>({
    startDate: "",
    endDate: "",
    academicYear: "",
    department: "",
    memberCategory: "",
    bookCategory: "",
    rfidDevice: "",
    gateId: "",
    operator: "",
    transactionStatus: "",
    page: 1,
    limit: 15,
  });

  // Applied filters sent to API
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterParams>({
    page: 1,
    limit: 15,
  });

  const [exportStatus, setExportStatus] = useState<{
    loading: boolean;
    format?: "pdf" | "csv";
    message?: string;
    error?: string;
  }>({ loading: false });

  const activeMeta = useMemo(
    () => REPORT_TABS.find((t) => t.key === selectedTab) ?? REPORT_TABS[1]!,
    [selectedTab]
  );

  // Clean query params so empty strings are omitted
  const sanitizedQueryParams = useMemo(() => {
    const out: Record<string, unknown> = {};
    Object.entries(appliedFilters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        out[k] = v;
      }
    });
    return out;
  }, [appliedFilters]);

  // Fetch active report data
  const {
    data: reportRes,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<any>>({
    queryKey: ["reports", selectedTab, sanitizedQueryParams],
    queryFn: () => apiGet<ApiResponse<any>>(activeMeta.endpoint, sanitizedQueryParams),
    staleTime: 15_000,
  });

  // Also fetch executive dashboard summary for top-level context
  const { data: dashRes } = useQuery<ApiResponse<any>>({
    queryKey: ["reports", "DASHBOARD", "header"],
    queryFn: () => apiGet<ApiResponse<any>>("/reports/dashboard"),
    staleTime: 30_000,
  });

  const reportData = reportRes?.data;
  const pagination = reportData?.pagination;

  const handleGenerateReport = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedFilters({ ...draftFilters, page: 1 });
  };

  const handleResetFilters = () => {
    const reset: ReportFilterParams = {
      startDate: "",
      endDate: "",
      academicYear: "",
      department: "",
      memberCategory: "",
      bookCategory: "",
      rfidDevice: "",
      gateId: "",
      operator: "",
      transactionStatus: "",
      page: 1,
      limit: 15,
    };
    setDraftFilters(reset);
    setAppliedFilters({ page: 1, limit: 15 });
  };

  const handlePageChange = (newPage: number) => {
    setDraftFilters((prev) => ({ ...prev, page: newPage }));
    setAppliedFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleExport = async (format: "pdf" | "csv") => {
    setExportStatus({ loading: true, format });
    try {
      const exportParams: Record<string, unknown> = {
        ...sanitizedQueryParams,
        type: selectedTab === "SECURITY_GATES" ? "SECURITY_GATES" : selectedTab,
        limit: 200,
      };
      delete exportParams.page;

      const endpoint = format === "pdf" ? "/reports/export/pdf" : "/reports/export/csv";
      const defaultName = `smartlib-${selectedTab.toLowerCase()}-report.${format}`;
      const { blob, filename } = await apiDownload(endpoint, exportParams, defaultName);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportStatus({
        loading: false,
        message: `Successfully exported ${filename}`,
      });
    } catch (err: any) {
      setExportStatus({
        loading: false,
        error: err?.response?.data?.message || "Failed to export report. Please verify filters.",
      });
    }
  };

  // Extract KPI summary cards dynamically per report type
  const summaryMetrics = useMemo(() => {
    if (!reportData) return [];

    switch (selectedTab) {
      case "DASHBOARD":
        return [
          { label: "Total Titles", value: reportData.catalog?.totalTitles ?? 0 },
          { label: "Physical Copies", value: reportData.catalog?.totalPhysicalCopies ?? 0 },
          { label: "RFID Tagged Copies", value: reportData.catalog?.rfidTaggedCopies ?? 0 },
          { label: "Active Loans", value: reportData.circulation?.activeLoans ?? 0 },
          { label: "Overdue Loans", value: reportData.circulation?.overdueLoans ?? 0 },
          {
            label: "Outstanding Fines",
            value: `₹${Number(reportData.fines?.outstandingBalance ?? 0).toFixed(2)}`,
          },
        ];
      case "CIRCULATION":
        return [
          { label: "Total Issues", value: reportData.summary?.totalIssues ?? 0 },
          { label: "Total Returns", value: reportData.summary?.totalReturns ?? 0 },
          { label: "Active Loans", value: reportData.summary?.activeLoans ?? 0 },
          { label: "Overdue Loans", value: reportData.summary?.overdueLoans ?? 0 },
          { label: "Total Renewals", value: reportData.summary?.totalRenewals ?? 0 },
        ];
      case "OVERDUE":
        return [
          { label: "Total Overdue Items", value: reportData.summary?.totalOverdueItems ?? 0 },
          { label: "Avg Overdue Days", value: `${reportData.summary?.averageOverdueDays ?? 0} days` },
          {
            label: "Total Accrued Fine",
            value: `₹${Number(reportData.summary?.totalAccruedFine ?? 0).toFixed(2)}`,
          },
          {
            label: "Configured Daily Rate",
            value: `₹${Number(reportData.summary?.dailyFineRate ?? 5).toFixed(2)}/day`,
          },
        ];
      case "INVENTORY":
        return [
          { label: "Total Physical Copies", value: reportData.summary?.totalPhysicalCopies ?? 0 },
          { label: "Available Copies", value: reportData.summary?.availableCopies ?? 0 },
          { label: "Issued Copies", value: reportData.summary?.issuedCopies ?? 0 },
          { label: "RFID-Tagged Copies", value: reportData.summary?.rfidTaggedCopies ?? 0 },
          { label: "Missing Copies", value: reportData.summary?.missingCopies ?? 0 },
          { label: "Misplaced / Uncatalogued", value: `${reportData.summary?.misplacedCopies ?? 0} / ${reportData.summary?.uncataloguedScans ?? 0}` },
        ];
      case "MEMBERS":
        return [
          { label: "Active Members", value: reportData.summary?.activeMembers ?? 0 },
          { label: "Inactive Members", value: reportData.summary?.inactiveMembers ?? 0 },
          { label: "Blocked Members", value: reportData.summary?.blockedMembers ?? 0 },
          {
            label: "Outstanding Fines",
            value: `₹${Number(reportData.summary?.totalOutstandingFines ?? 0).toFixed(2)}`,
          },
        ];
      case "FINES":
        return [
          {
            label: "Total Assessed Fines",
            value: `₹${Number(reportData.summary?.totalAssessedFines ?? 0).toFixed(2)}`,
          },
          {
            label: "Paid Fines",
            value: `₹${Number(reportData.summary?.paidFines ?? 0).toFixed(2)}`,
          },
          {
            label: "Outstanding Fines",
            value: `₹${Number(reportData.summary?.outstandingFines ?? 0).toFixed(2)}`,
          },
          {
            label: "Waived Fines",
            value: `₹${Number(reportData.summary?.waivedFines ?? 0).toFixed(2)}`,
          },
          {
            label: "Partial Payments",
            value: `₹${Number(reportData.summary?.partialPayments ?? 0).toFixed(2)}`,
          },
        ];
      case "RFID":
        return [
          { label: "Tagged Items", value: reportData.summary?.taggedItems ?? 0 },
          { label: "EAS Armed Tags", value: reportData.summary?.easArmedCount ?? 0 },
          { label: "Reader Events", value: reportData.summary?.readerEvents ?? 0 },
          { label: "Failed Scans", value: reportData.summary?.failedScans ?? 0 },
          {
            label: "Device Availability",
            value: `${reportData.summary?.deviceAvailabilityPercent ?? 100}% (${reportData.summary?.devicesOnline ?? 0}/${reportData.summary?.devicesTotal ?? 0})`,
          },
        ];
      case "SECURITY_GATES":
        return [
          { label: "Authorized Passages", value: reportData.summary?.authorizedPassages ?? 0 },
          { label: "Unauthorized Passages", value: reportData.summary?.unauthorizedPassages ?? 0 },
          { label: "Alarm Events", value: reportData.summary?.alarmEvents ?? 0 },
          { label: "Total Footfall Count", value: reportData.summary?.totalFootfallCount ?? 0 },
        ];
      case "OPERATORS":
        return [
          { label: "Active Operators", value: reportData.summary?.activeOperators ?? 0 },
          { label: "Circulation Operations", value: reportData.summary?.totalCirculationOperations ?? 0 },
          { label: "RFID Operations", value: reportData.summary?.totalRfidOperations ?? 0 },
          { label: "Administrative Changes", value: reportData.summary?.totalAdministrativeChanges ?? 0 },
          { label: "Total Audit Events", value: reportData.summary?.totalAuditEvents ?? 0 },
        ];
      case "MIGRATIONS":
        return [
          { label: "Uploaded Batches", value: reportData.summary?.uploadedBatches ?? 0 },
          { label: "Source Row Counts", value: reportData.summary?.sourceRowCounts ?? 0 },
          { label: "Valid Records", value: reportData.summary?.validRecords ?? 0 },
          { label: "Invalid / Duplicate", value: `${reportData.summary?.invalidRecords ?? 0} / ${reportData.summary?.duplicateRecords ?? 0}` },
          { label: "Committed Records", value: reportData.summary?.committedRecords ?? 0 },
          { label: "Rolled-Back Batches", value: reportData.summary?.rolledBackBatches ?? 0 },
        ];
      default:
        return [];
    }
  }, [reportData, selectedTab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Institutional Analytics"
        description="Accurate, filterable, exportable NAAC/NBA/AICTE institutional compliance reports powered by live Neon PostgreSQL telemetry"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Reports & Analytics" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="refresh-report-btn"
            >
              <RefreshCw className={`size-4 mr-1.5 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport("csv")}
              disabled={exportStatus.loading}
              data-testid="export-csv-btn"
            >
              {exportStatus.loading && exportStatus.format === "csv" ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4 mr-1.5" />
              )}
              Export CSV
            </Button>
            <Button
              size="sm"
              onClick={() => handleExport("pdf")}
              disabled={exportStatus.loading}
              data-testid="export-pdf-btn"
            >
              {exportStatus.loading && exportStatus.format === "pdf" ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="size-4 mr-1.5" />
              )}
              Export PDF
            </Button>
          </div>
        }
      />

      {/* Export Feedback Banner */}
      {exportStatus.message && (
        <div
          className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 flex items-center justify-between"
          data-testid="export-success-banner"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="size-4" />
            {exportStatus.message}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setExportStatus({ loading: false })}
          >
            Dismiss
          </Button>
        </div>
      )}

      {exportStatus.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm text-destructive flex items-center justify-between">
          <span>{exportStatus.error}</span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setExportStatus({ loading: false })}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Report Category Navigation */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5"
        role="tablist"
        aria-label="Report Categories"
      >
        {REPORT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isSelected = tab.key === selectedTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              data-testid={`report-tab-${tab.key.toLowerCase()}`}
              onClick={() => {
                setSelectedTab(tab.key);
                setAppliedFilters((prev) => ({ ...prev, page: 1 }));
              }}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                isSelected
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                  {tab.badge}
                </Badge>
                <Icon className={`size-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className="text-xs font-semibold leading-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Filter Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                {activeMeta.label} — Filter & Scope Configuration
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{activeMeta.description}</CardDescription>
            </div>
            <Badge variant="outline" className="self-start sm:self-auto text-xs font-mono">
              GET /api/v1{activeMeta.endpoint}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateReport} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
              <div>
                <label htmlFor="filter-start-date" className="text-xs font-medium text-foreground block">
                  Start Date
                </label>
                <Input
                  id="filter-start-date"
                  type="date"
                  value={draftFilters.startDate || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, startDate: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-end-date" className="text-xs font-medium text-foreground block">
                  End Date
                </label>
                <Input
                  id="filter-end-date"
                  type="date"
                  value={draftFilters.endDate || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, endDate: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-academic-year" className="text-xs font-medium text-foreground block">
                  Academic Year
                </label>
                <Input
                  id="filter-academic-year"
                  placeholder="e.g. 2025-2026"
                  value={draftFilters.academicYear || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, academicYear: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-department" className="text-xs font-medium text-foreground block">
                  Department
                </label>
                <Input
                  id="filter-department"
                  placeholder="e.g. Computer Science"
                  value={draftFilters.department || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, department: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-member-category" className="text-xs font-medium text-foreground block">
                  Member Category
                </label>
                <select
                  id="filter-member-category"
                  value={draftFilters.memberCategory || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, memberCategory: e.target.value })}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                >
                  <option value="">All Patron Categories</option>
                  <option value="STUDENT">STUDENT</option>
                  <option value="FACULTY">FACULTY</option>
                  <option value="RESEARCH_SCHOLAR">RESEARCH_SCHOLAR</option>
                  <option value="STAFF">STAFF</option>
                  <option value="GUEST">GUEST</option>
                </select>
              </div>

              <div>
                <label htmlFor="filter-book-category" className="text-xs font-medium text-foreground block">
                  Book Category
                </label>
                <Input
                  id="filter-book-category"
                  placeholder="e.g. Software Engineering"
                  value={draftFilters.bookCategory || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, bookCategory: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-rfid-device" className="text-xs font-medium text-foreground block">
                  RFID Device
                </label>
                <Input
                  id="filter-rfid-device"
                  placeholder="e.g. RDR-DESK-01"
                  value={draftFilters.rfidDevice || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, rfidDevice: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-gate-id" className="text-xs font-medium text-foreground block">
                  Gate Identifier
                </label>
                <Input
                  id="filter-gate-id"
                  placeholder="e.g. GATE-MAIN-01"
                  value={draftFilters.gateId || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, gateId: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-operator" className="text-xs font-medium text-foreground block">
                  Operator
                </label>
                <Input
                  id="filter-operator"
                  placeholder="Staff name or email"
                  value={draftFilters.operator || ""}
                  onChange={(e) => setDraftFilters({ ...draftFilters, operator: e.target.value })}
                  className="h-8 text-xs mt-1"
                />
              </div>

              <div>
                <label htmlFor="filter-status" className="text-xs font-medium text-foreground block">
                  Transaction Status
                </label>
                <select
                  id="filter-status"
                  value={draftFilters.transactionStatus || ""}
                  onChange={(e) =>
                    setDraftFilters({ ...draftFilters, transactionStatus: e.target.value })
                  }
                  className="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="RETURNED">RETURNED</option>
                  <option value="OVERDUE">OVERDUE</option>
                  <option value="AVAILABLE">AVAILABLE</option>
                  <option value="ISSUED">ISSUED</option>
                  <option value="UNPAID">UNPAID</option>
                  <option value="PAID">PAID</option>
                  <option value="WAIVED">WAIVED</option>
                  <option value="COMMITTED">COMMITTED</option>
                  <option value="ROLLED_BACK">ROLLED_BACK</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleResetFilters}
                data-testid="reset-filters-btn"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Reset Filters
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isFetching}
                onClick={handleGenerateReport}
                data-testid="generate-report-btn"
              >
                {isFetching ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <BarChart3 className="size-3.5 mr-1.5" />
                )}
                Generate Report
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <Skeleton key={n} className="h-24 w-full rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
            <p className="font-semibold text-sm text-destructive">Failed to load report data</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as any)?.response?.data?.message ||
                (error as Error)?.message ||
                "Please verify your filter parameters and try again."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary KPI Metric Cards */}
          {summaryMetrics.length > 0 && (
            <div
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
              data-testid="report-summary-metrics"
            >
              {summaryMetrics.map((m, idx) => (
                <Card key={idx} className="bg-card">
                  <CardContent className="p-4">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {m.label}
                    </p>
                    <p className="text-xl font-bold mt-1 text-foreground">{m.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Analytics Visualization Section (Recharts derived from real API data) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Context-specific primary chart */}
            {selectedTab === "CIRCULATION" && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Daily Circulation Trend (Issues vs Returns)</CardTitle>
                    <CardDescription className="text-xs">
                      Real-time daily checkout and return activity within filter window
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {reportData?.trends?.daily?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={reportData.trends.daily}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="issues"
                            name="Issues"
                            stroke="#2563EB"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="returns"
                            name="Returns"
                            stroke="#0D9488"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        title="No circulation trend data"
                        description="No loans recorded within the selected date range."
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Monthly Borrowing Volume</CardTitle>
                    <CardDescription className="text-xs">
                      Aggregated monthly issues and returns
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {reportData?.trends?.monthly?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.trends.monthly}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="issues" name="Issues" fill="#2563EB" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="returns" name="Returns" fill="#10B981" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState
                        title="No monthly borrowing data"
                        description="No monthly records match the applied filters."
                      />
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {selectedTab === "DASHBOARD" && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">7-Day Circulation Velocity</CardTitle>
                    <CardDescription className="text-xs">
                      Issues vs returns over the last 7 days
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {reportData?.charts?.circulationTrend?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={reportData.charts.circulationTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="issues" name="Issues" stroke="#2563EB" strokeWidth={2} />
                          <Line type="monotone" dataKey="returns" name="Returns" stroke="#0D9488" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No recent circulation" description="No activity in the last 7 days." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Catalog Category Distribution</CardTitle>
                    <CardDescription className="text-xs">
                      Bibliographic titles grouped by academic subject category
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {reportData?.charts?.categoryDistribution?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData.charts.categoryDistribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {reportData.charts.categoryDistribution.map((entry: any, i: number) => (
                              <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No categories found" description="Add books to populate distribution." />
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {selectedTab === "INVENTORY" && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Inventory Status Breakdown</CardTitle>
                    <CardDescription className="text-xs">
                      Physical copy distribution across circulation and shelf states
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {reportData?.statusBreakdown?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.statusBreakdown}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis dataKey="status" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="count" name="Copies" fill="#2563EB" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No inventory items" description="No physical copies found." />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Category Copy Distribution</CardTitle>
                    <CardDescription className="text-xs">
                      Physical copies grouped by subject category
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="h-64">
                    {reportData?.categoryDistribution?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={reportData.categoryDistribution}
                            dataKey="copies"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {reportData.categoryDistribution.map((entry: any, i: number) => (
                              <Cell key={i} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyState title="No category data" description="No categorized copies found." />
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {selectedTab === "FINES" && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Fine Assessment & Collection Trend</CardTitle>
                  <CardDescription className="text-xs">
                    Assessed vs collected vs waived monetary amounts (INR)
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {reportData?.collectionTrends?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.collectionTrends}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="assessed" name="Assessed (₹)" fill="#D97706" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="collected" name="Collected (₹)" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="waived" name="Waived (₹)" fill="#64748B" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="No fine trend data"
                      description="No fine assessments recorded for the selected filters."
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {selectedTab === "RFID" && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">RFID Hardware Reader Activity</CardTitle>
                  <CardDescription className="text-xs">
                    Cumulative scan and telemetry events per RFID hardware reader
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {reportData?.deviceActivity?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.deviceActivity}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="readerEvents" name="Reader Events" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="No RFID reader activity" description="No RFID devices matched." />
                  )}
                </CardContent>
              </Card>
            )}

            {selectedTab === "SECURITY_GATES" && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Security Gate Event Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Authorized passages vs EAS alarm triggers per security gate
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {reportData?.gateBreakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.gateBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="gateName" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="authorized" name="Authorized Passages" fill="#10B981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="alarms" name="EAS Alarms" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="No gate events recorded"
                      description="No security gate passages match the current filter criteria."
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {selectedTab === "MEMBERS" && (
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Membership Category Breakdown</CardTitle>
                  <CardDescription className="text-xs">
                    Registered patrons segmented by institutional membership type
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-64">
                  {reportData?.categoryBreakdown?.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.categoryBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip />
                        <Bar dataKey="count" name="Members" fill="#0D9488" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState title="No member categories" description="No member records found." />
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Most Borrowed Books Highlight (Circulation Report) */}
          {selectedTab === "CIRCULATION" && reportData?.mostBorrowedBooks?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Most Borrowed Books</CardTitle>
                <CardDescription className="text-xs">
                  Highest-demand bibliographic titles ranked by loan frequency
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {reportData.mostBorrowedBooks.slice(0, 6).map((b: any, i: number) => (
                    <div
                      key={b.bookId || i}
                      className="flex items-center justify-between rounded-md border p-3 bg-muted/20"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-semibold truncate">{b.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {b.category} {b.isbn13 ? `• ${b.isbn13}` : ""}
                        </p>
                      </div>
                      <Badge variant="default" className="shrink-0">
                        {b.borrowCount} loans
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Paginated Tabular Result Set */}
          {selectedTab !== "DASHBOARD" && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{activeMeta.label} — Detailed Records</CardTitle>
                    <CardDescription className="text-xs">
                      Showing page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1} (
                      {pagination?.total ?? reportData?.records?.length ?? 0} total matching records)
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {!reportData?.records || reportData.records.length === 0 ? (
                  <EmptyState
                    title="No matching records"
                    description="Adjust or reset the filter parameters above to broaden your report query."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedTab === "CIRCULATION" && (
                            <>
                              <TableHead>Accession #</TableHead>
                              <TableHead>Book Title</TableHead>
                              <TableHead>Patron</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Issued Date</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Renewals</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          )}
                          {selectedTab === "OVERDUE" && (
                            <>
                              <TableHead>Accession #</TableHead>
                              <TableHead>Book Title</TableHead>
                              <TableHead>Member</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Due Date</TableHead>
                              <TableHead>Overdue Days</TableHead>
                              <TableHead>Fine Amount</TableHead>
                            </>
                          )}
                          {selectedTab === "INVENTORY" && (
                            <>
                              <TableHead>Accession #</TableHead>
                              <TableHead>Book Title</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Shelf Location</TableHead>
                              <TableHead>Condition</TableHead>
                              <TableHead>RFID Tag</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          )}
                          {selectedTab === "MEMBERS" && (
                            <>
                              <TableHead>Card #</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Department</TableHead>
                              <TableHead>Loans</TableHead>
                              <TableHead>Outstanding Fine</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          )}
                          {selectedTab === "FINES" && (
                            <>
                              <TableHead>Date</TableHead>
                              <TableHead>Member</TableHead>
                              <TableHead>Book / Accession</TableHead>
                              <TableHead>Reason</TableHead>
                              <TableHead>Assessed</TableHead>
                              <TableHead>Paid</TableHead>
                              <TableHead>Balance</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          )}
                          {selectedTab === "RFID" && (
                            <>
                              <TableHead>EPC Code</TableHead>
                              <TableHead>Accession #</TableHead>
                              <TableHead>Book Title</TableHead>
                              <TableHead>EAS Security</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Encoded Date</TableHead>
                            </>
                          )}
                          {selectedTab === "SECURITY_GATES" && (
                            <>
                              <TableHead>Timestamp</TableHead>
                              <TableHead>Gate ID</TableHead>
                              <TableHead>Accession #</TableHead>
                              <TableHead>Passage Status</TableHead>
                              <TableHead>Footfall</TableHead>
                              <TableHead>CCTV Ref</TableHead>
                            </>
                          )}
                          {selectedTab === "OPERATORS" && (
                            <>
                              <TableHead>Timestamp</TableHead>
                              <TableHead>Operator</TableHead>
                              <TableHead>Role</TableHead>
                              <TableHead>Action</TableHead>
                              <TableHead>Entity</TableHead>
                              <TableHead>IP Address</TableHead>
                            </>
                          )}
                          {selectedTab === "MIGRATIONS" && (
                            <>
                              <TableHead>Batch Name</TableHead>
                              <TableHead>Source File</TableHead>
                              <TableHead>Source Rows</TableHead>
                              <TableHead>Valid</TableHead>
                              <TableHead>Invalid</TableHead>
                              <TableHead>Committed</TableHead>
                              <TableHead>Status</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.records.map((row: any, idx: number) => (
                          <TableRow key={row.id || idx}>
                            {selectedTab === "CIRCULATION" && (
                              <>
                                <TableCell className="font-mono text-xs">{row.accessionNumber}</TableCell>
                                <TableCell className="font-medium text-xs max-w-[220px] truncate">
                                  {row.bookTitle}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.memberName} ({row.cardNumber})
                                </TableCell>
                                <TableCell className="text-xs">{row.department}</TableCell>
                                <TableCell className="text-xs">{formatDateTime(row.issuedDate)}</TableCell>
                                <TableCell className="text-xs">{formatDateTime(row.dueDate)}</TableCell>
                                <TableCell className="text-xs">{row.renewalCount}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      row.status === "RETURNED"
                                        ? "secondary"
                                        : row.status === "OVERDUE"
                                        ? "destructive"
                                        : "default"
                                    }
                                    className="text-[10px]"
                                  >
                                    {row.status}
                                  </Badge>
                                </TableCell>
                              </>
                            )}

                            {selectedTab === "OVERDUE" && (
                              <>
                                <TableCell className="font-mono text-xs">{row.accessionNumber}</TableCell>
                                <TableCell className="font-medium text-xs max-w-[200px] truncate">
                                  {row.bookTitle}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.memberName} ({row.cardNumber})
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {row.contactEmail}
                                </TableCell>
                                <TableCell className="text-xs">{formatDateTime(row.dueDate)}</TableCell>
                                <TableCell>
                                  <Badge variant="destructive" className="text-[10px]">
                                    {row.overdueDays} days
                                  </Badge>
                                </TableCell>
                                <TableCell className="font-semibold text-xs text-destructive">
                                  ₹{Number(row.fineAmount).toFixed(2)}
                                </TableCell>
                              </>
                            )}

                            {selectedTab === "INVENTORY" && (
                              <>
                                <TableCell className="font-mono text-xs">{row.accessionNumber}</TableCell>
                                <TableCell className="font-medium text-xs max-w-[220px] truncate">
                                  {row.bookTitle}
                                </TableCell>
                                <TableCell className="text-xs">{row.category}</TableCell>
                                <TableCell className="font-mono text-xs">{row.shelfLocation}</TableCell>
                                <TableCell className="text-xs">{row.condition}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={row.rfidTagged ? "default" : "outline"}
                                    className="text-[10px]"
                                  >
                                    {row.rfidTagged ? "TAGGED" : "UNTAGGED"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {row.status}
                                  </Badge>
                                </TableCell>
                              </>
                            )}

                            {selectedTab === "MEMBERS" && (
                              <>
                                <TableCell className="font-mono text-xs">{row.cardNumber}</TableCell>
                                <TableCell className="font-medium text-xs">{row.name}</TableCell>
                                <TableCell className="text-xs">{row.memberCategory}</TableCell>
                                <TableCell className="text-xs">{row.department}</TableCell>
                                <TableCell className="text-xs">{row.borrowingFrequency}</TableCell>
                                <TableCell className="text-xs font-medium">
                                  ₹{Number(row.outstandingFines).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={row.status === "ACTIVE" ? "default" : "destructive"}
                                    className="text-[10px]"
                                  >
                                    {row.status}
                                  </Badge>
                                </TableCell>
                              </>
                            )}

                            {selectedTab === "FINES" && (
                              <>
                                <TableCell className="text-xs">{formatDateTime(row.date)}</TableCell>
                                <TableCell className="text-xs">
                                  {row.memberName} ({row.cardNumber})
                                </TableCell>
                                <TableCell className="text-xs max-w-[180px] truncate">
                                  {row.bookTitle} ({row.accessionNumber})
                                </TableCell>
                                <TableCell className="text-xs">{row.reason}</TableCell>
                                <TableCell className="text-xs">
                                  ₹{Number(row.assessedAmount).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-xs text-emerald-600 font-medium">
                                  ₹{Number(row.paidAmount).toFixed(2)}
                                </TableCell>
                                <TableCell className="text-xs font-semibold">
                                  ₹{Number(row.balance).toFixed(2)}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={
                                      row.status === "PAID"
                                        ? "default"
                                        : row.status === "WAIVED"
                                        ? "secondary"
                                        : "destructive"
                                    }
                                    className="text-[10px]"
                                  >
                                    {row.status}
                                  </Badge>
                                </TableCell>
                              </>
                            )}

                            {selectedTab === "RFID" && (
                              <>
                                <TableCell className="font-mono text-xs">{row.epc}</TableCell>
                                <TableCell className="font-mono text-xs">{row.accessionNumber}</TableCell>
                                <TableCell className="text-xs max-w-[200px] truncate">
                                  {row.bookTitle}
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={row.easArmed ? "default" : "secondary"}
                                    className="text-[10px]"
                                  >
                                    {row.easArmed ? "EAS ARMED" : "DISARMED"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{row.status}</TableCell>
                                <TableCell className="text-xs">{formatDateTime(row.encodedAt)}</TableCell>
                              </>
                            )}

                            {selectedTab === "SECURITY_GATES" && (
                              <>
                                <TableCell className="text-xs">{formatDateTime(row.timestamp)}</TableCell>
                                <TableCell className="font-mono text-xs">{row.gateIdentifier}</TableCell>
                                <TableCell className="font-mono text-xs">{row.accessionNumber}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant={row.alarmTriggered ? "destructive" : "default"}
                                    className="text-[10px]"
                                  >
                                    {row.passageStatus}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{row.footfallCount}</TableCell>
                                <TableCell className="font-mono text-xs">{row.cctvReference}</TableCell>
                              </>
                            )}

                            {selectedTab === "OPERATORS" && (
                              <>
                                <TableCell className="text-xs">{formatDateTime(row.timestamp)}</TableCell>
                                <TableCell className="text-xs font-medium">{row.operatorName}</TableCell>
                                <TableCell className="text-xs">{row.role}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[10px] font-mono">
                                    {row.action}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.entityName} ({row.entityId.slice(0, 8)})
                                </TableCell>
                                <TableCell className="font-mono text-xs">{row.ipAddress}</TableCell>
                              </>
                            )}

                            {selectedTab === "MIGRATIONS" && (
                              <>
                                <TableCell className="font-medium text-xs">{row.batchName}</TableCell>
                                <TableCell className="font-mono text-xs">{row.sourceFileName}</TableCell>
                                <TableCell className="text-xs">{row.sourceRowCount}</TableCell>
                                <TableCell className="text-xs text-emerald-600">
                                  {row.validRecords}
                                </TableCell>
                                <TableCell className="text-xs text-destructive">
                                  {row.invalidRecords}
                                </TableCell>
                                <TableCell className="text-xs font-semibold">
                                  {row.committedRecords}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-[10px]">
                                    {row.status}
                                  </Badge>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between pt-4 mt-4 border-t">
                    <span className="text-xs text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages} ({pagination.total} records)
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagination.page <= 1 || isFetching}
                        onClick={() => handlePageChange(pagination.page - 1)}
                      >
                        <ChevronLeft className="size-4 mr-1" />
                        Previous
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pagination.page >= pagination.totalPages || isFetching}
                        onClick={() => handlePageChange(pagination.page + 1)}
                      >
                        Next
                        <ChevronRight className="size-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Institutional Footer Summary */}
          {dashRes?.data && (
            <div className="rounded-lg border bg-muted/20 p-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground">Live Neon PostgreSQL Synchronization:</span>{" "}
                {dashRes.data.catalog?.totalTitles ?? 0} bibliographic titles •{" "}
                {dashRes.data.catalog?.totalPhysicalCopies ?? 0} physical copies •{" "}
                {dashRes.data.patrons?.activeMembers ?? 0} active members
              </div>
              <div className="font-mono">
                Snapshot: {formatDateTime(dashRes.data.generatedAt || new Date().toISOString())}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
