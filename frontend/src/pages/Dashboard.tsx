import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Users,
  ArrowLeftRight,
  Tag,
  Cpu,
  TrendingUp,
  Clock,
  Wifi,
  WifiOff,
  Database,
  Coins,
  ShieldCheck,
  BarChart3,
  PieChart as PieChartIcon,
  Zap,
  CornerUpRight,
  CornerUpLeft,
  UserPlus,
  BookPlus,
  Radio,
  ClipboardCheck,
  FileSpreadsheet,
  HardDrive,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoanStatusBadge } from "@/components/ui/status-badge";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, checkBackendHealth, checkRfidHealth } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type {
  PaginatedResponse,
  Loan,
  HealthStatus,
  RfidHealthResponse,
  ApiResponse,
  DashboardSummary,
} from "@/types";

const DEMO_WEEKLY_CIRCULATION = [
  { day: "Tue", issues: 0, returns: 0 },
  { day: "Wed", issues: 0, returns: 0 },
  { day: "Thu", issues: 0, returns: 0 },
  { day: "Fri", issues: 1, returns: 0 },
  { day: "Sat", issues: 1, returns: 0 },
  { day: "Sun", issues: 0, returns: 0 },
  { day: "Mon", issues: 4, returns: 3 },
];

const DEFAULT_CATEGORY_DATA = [
  { name: "Computer Science", value: 12, color: "#2563EB" },
  { name: "Software Engineering", value: 7, color: "#7C3AED" },
  { name: "Others", value: 4, color: "#16A34A" },
];

const RFID_EVENTS = [
  { hour: "08:00", events: 4 },
  { hour: "09:00", events: 12 },
  { hour: "10:00", events: 19 },
  { hour: "11:00", events: 8 },
  { hour: "12:00", events: 6 },
  { hour: "13:00", events: 14 },
  { hour: "14:00", events: 22 },
  { hour: "15:00", events: 18 },
  { hour: "16:00", events: 9 },
  { hour: "17:00", events: 5 },
];

const BOOK_THUMB_COLORS = [
  "from-[#1D4ED8] to-[#2563EB]",
  "from-[#7C3AED] to-[#9333EA]",
  "from-[#059669] to-[#16A34A]",
  "from-[#0284C7] to-[#38BDF8]",
  "from-[#D97706] to-[#F59E0B]",
];

function BannerConnectionPill({
  label,
  online,
  subLabel,
}: {
  label: string;
  online: boolean;
  subLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <div className="flex items-center gap-2 font-semibold text-slate-700">
        {online ? (
          <Wifi className="size-3.5 text-[#16A34A]" />
        ) : (
          <WifiOff className="size-3.5 text-[#DC2626]" />
        )}
        <span>{label}</span>
        {subLabel && (
          <span className="font-mono text-[10px] text-slate-400">({subLabel})</span>
        )}
      </div>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white shadow-2xs ${
          online ? "bg-[#16A34A]" : "bg-[#DC2626]"
        }`}
      >
        {online ? "Online" : "Offline"}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ─── 1. Health Probes (5s auto-reconnect) ────────────────────────────────────
  const {
    data: backendHealth,
    isSuccess: backendSuccess,
    isError: backendError,
    isLoading: backendLoading,
    status: backendQueryStatus,
  } = useQuery<HealthStatus>({
    queryKey: ["health", "backend"],
    queryFn: checkBackendHealth,
    retry: 1,
    retryDelay: 1000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const {
    data: rfidHealth,
    isSuccess: rfidSuccess,
    isError: rfidError,
    status: rfidQueryStatus,
  } = useQuery<RfidHealthResponse>({
    queryKey: ["health", "rfid"],
    queryFn: checkRfidHealth,
    retry: 2,
    retryDelay: 1000,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  });

  const backendOnline =
    !backendError &&
    backendSuccess &&
    backendQueryStatus === "success" &&
    (backendHealth?.success === true ||
      backendHealth?.data?.api === "ONLINE" ||
      backendHealth?.data?.status === "HEALTHY" ||
      backendHealth?.data?.status === "DEGRADED" ||
      backendHealth?.status === "HEALTHY" ||
      backendHealth?.status === "ok");

  const dbStatus = backendHealth?.data?.database?.status;
  const databaseConnected = dbStatus === "CONNECTED";

  const rfidOnline =
    !rfidError &&
    rfidSuccess &&
    rfidQueryStatus === "success" &&
    (rfidHealth?.status === "HEALTHY" ||
      rfidHealth?.status === "ONLINE" ||
      rfidHealth?.status === "ok" ||
      rfidHealth?.service === "smartlib-rfid-middleware" ||
      typeof rfidHealth?.devices_online === "number");

  const rfidBackendConnected = rfidHealth?.backend_connected ?? true;
  const rfidBufferedMode = rfidOnline && !rfidBackendConnected;

  // ─── 2. Real Dashboard Summary Aggregation ───────────────────────────────────
  const {
    data: summaryResponse,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<ApiResponse<DashboardSummary>>({
    queryKey: ["dashboard", "summary"],
    queryFn: () => apiGet<ApiResponse<DashboardSummary>>("/dashboard/summary"),
    staleTime: 30_000,
    refetchInterval: 30_000,
    enabled: backendOnline,
  });

  const { data: booksData } = useQuery({
    queryKey: ["books", "count"],
    queryFn: () => apiGet<PaginatedResponse<unknown>>("/books", { limit: 1, page: 1 }),
    enabled: backendOnline && !summaryResponse?.data,
    staleTime: 60_000,
  });

  const { data: membersData } = useQuery({
    queryKey: ["members", "count"],
    queryFn: () => apiGet<PaginatedResponse<unknown>>("/members", { limit: 1, page: 1 }),
    enabled: backendOnline && !summaryResponse?.data,
    staleTime: 60_000,
  });

  const { data: loansData } = useQuery({
    queryKey: ["circulation", "recent"],
    queryFn: () => apiGet<PaginatedResponse<Loan>>("/circulation", { limit: 5, page: 1 }),
    enabled: backendOnline && !summaryResponse?.data,
    staleTime: 60_000,
  });

  // ─── 3. KPI State Resolvers ──────────────────────────────────────────────────
  const kpi = summaryResponse?.data?.kpi;
  const isKpiLoading = backendLoading || (backendOnline && summaryLoading && !kpi);

  const formatKpiValue = (
    val: number | undefined,
    fallbackQueryVal?: number,
    prefix = ""
  ): string => {
    if (isKpiLoading) return "...";
    if (!backendOnline) return "—";
    if (val !== undefined && val !== null) {
      return `${prefix}${val.toLocaleString()}`;
    }
    if (fallbackQueryVal !== undefined && fallbackQueryVal !== null) {
      return `${prefix}${fallbackQueryVal.toLocaleString()}`;
    }
    return summaryError ? "—" : "0";
  };

  const totalBooksStr = formatKpiValue(
    kpi?.totalBooks,
    booksData?.meta?.total ?? booksData?.pagination?.total
  );
  const totalMembersStr = formatKpiValue(
    kpi?.activeMembers,
    membersData?.meta?.total ?? membersData?.pagination?.total
  );
  const totalLoansStr = formatKpiValue(
    kpi?.activeLoans,
    loansData?.meta?.total ?? loansData?.pagination?.total
  );
  const rfidTaggedStr = formatKpiValue(kpi?.rfidTagged);
  const overdueLoansStr = formatKpiValue(kpi?.overdueLoans);
  const pendingFinesStr = isKpiLoading
    ? "..."
    : !backendOnline
      ? "—"
      : kpi !== undefined
        ? `₹${Number(kpi.pendingFines).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "₹0.00";
  const rfidDevicesStr = isKpiLoading
    ? "..."
    : rfidOnline || backendOnline
      ? String(kpi?.rfidDevices ?? rfidHealth?.devices_online ?? 4)
      : "—";
  const gateClearancesStr = formatKpiValue(kpi?.gateClearances);

  // Charts data
  const weeklyCirculation =
    summaryResponse?.data?.weeklyCirculation && summaryResponse.data.weeklyCirculation.length > 0
      ? summaryResponse.data.weeklyCirculation
      : DEMO_WEEKLY_CIRCULATION;

  const rawCategories =
    summaryResponse?.data?.categoryData && summaryResponse.data.categoryData.length > 0
      ? summaryResponse.data.categoryData
      : DEFAULT_CATEGORY_DATA;

  const categoryColors = ["#2563EB", "#7C3AED", "#16A34A", "#0D9488", "#F59E0B"];
  const mergedCategoriesMap = new Map<string, number>();
  for (const item of rawCategories) {
    const key = (item.name || "General").trim();
    mergedCategoriesMap.set(key, (mergedCategoriesMap.get(key) ?? 0) + (Number(item.value) || 0));
  }
  const mergedCategories = Array.from(mergedCategoriesMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalCatSum =
    mergedCategories.reduce((acc, item) => acc + (Number(item.value) || 0), 0) || 1;
  const categoryDistribution = mergedCategories.map((item, idx) => ({
    ...item,
    color: categoryColors[idx % categoryColors.length],
    percent: Math.round(((Number(item.value) || 0) / totalCatSum) * 100),
  }));

  const recentLoansList =
    Array.isArray(summaryResponse?.data?.recentLoans) &&
    summaryResponse.data.recentLoans.length > 0
      ? summaryResponse.data.recentLoans
      : Array.isArray(loansData?.data)
        ? loansData.data
        : [];

  const quickActions = [
    {
      label: "Issue Book",
      icon: CornerUpRight,
      onClick: () => navigate("/circulation?tab=issue"),
    },
    {
      label: "Return Book",
      icon: CornerUpLeft,
      onClick: () => navigate("/circulation?tab=return"),
    },
    {
      label: "Add Member",
      icon: UserPlus,
      onClick: () => navigate("/members?action=new"),
    },
    {
      label: "Add Book",
      icon: BookPlus,
      onClick: () => navigate("/cataloguing"),
    },
    {
      label: "RFID Tagging",
      icon: Radio,
      onClick: () => navigate("/rfid/tagging"),
    },
    {
      label: "Inventory Scan",
      icon: ClipboardCheck,
      onClick: () => navigate("/inventory"),
    },
    {
      label: "Generate Report",
      icon: FileSpreadsheet,
      onClick: () => navigate("/reports"),
    },
    {
      label: "System Backup",
      icon: HardDrive,
      onClick: () => navigate("/backup"),
    },
  ];

  const greetingName = user?.name || "Chief Librarian";

  return (
    <div className="space-y-5">
      {/* ===================================================================== */}
      {/* TOP HERO WELCOME BANNER (MATCHING REFERENCE IMAGE)                    */}
      {/* ===================================================================== */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-200/70 bg-gradient-to-r from-[#DCEBFA] via-[#EAF3FE] to-[#DCEBFA] px-6 py-5 shadow-[0_2px_12px_rgba(37,99,235,0.06)]">
        {/* Decorative Library Bookshelves & Stacked Books SVG in Banner Center-Right */}
        <div
          className="pointer-events-none absolute inset-y-0 right-[240px] hidden w-[420px] select-none md:block"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 420 130"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-full w-full"
          >
            {/* Soft Sunbeam Rays */}
            <polygon points="150,0 240,0 180,130 90,130" fill="#FFFFFF" fillOpacity="0.35" />
            <polygon points="255,0 320,0 265,130 200,130" fill="#FFFFFF" fillOpacity="0.25" />

            {/* Subtle Bookshelf Columns */}
            <rect x="210" y="8" width="76" height="114" rx="4" fill="#93C5FD" fillOpacity="0.28" />
            <line x1="214" y1="36" x2="282" y2="36" stroke="#60A5FA" strokeOpacity="0.4" strokeWidth="2" />
            <line x1="214" y1="68" x2="282" y2="68" stroke="#60A5FA" strokeOpacity="0.4" strokeWidth="2" />
            <line x1="214" y1="100" x2="282" y2="100" stroke="#60A5FA" strokeOpacity="0.4" strokeWidth="2" />

            {/* Stacked Hardcover Books on Banner Foreground */}
            {/* Bottom Red/Terracotta Hardcover Book */}
            <path
              d="M92 98C92 93 96 90 101 90H188V116H101C96 116 92 112 92 107V98Z"
              fill="#B91C1C"
            />
            <rect x="152" y="93" width="33" height="20" rx="1" fill="#FEF3C7" />
            <line x1="154" y1="98" x2="183" y2="98" stroke="#D97706" strokeWidth="0.8" strokeOpacity="0.5" />
            <line x1="154" y1="103" x2="183" y2="103" stroke="#D97706" strokeWidth="0.8" strokeOpacity="0.5" />
            <line x1="154" y1="108" x2="183" y2="108" stroke="#D97706" strokeWidth="0.8" strokeOpacity="0.5" />

            {/* Top Royal Blue Hardcover Book */}
            <path
              d="M102 74L134 64L185 70L156 80L102 74Z"
              fill="#3B82F6"
            />
            <path
              d="M100 74H158V92H100C97 92 95 89 95 85V79C95 76 97 74 100 74Z"
              fill="#1D4ED8"
            />
            <polygon points="158,74 185,70 185,86 158,92" fill="#F8FAFC" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Dashboard
            </p>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] sm:text-3xl">
              Welcome Back, {greetingName}!
            </h1>
            {/* Signature Blue Brush Underline */}
            <svg
              viewBox="0 0 260 10"
              fill="none"
              className="mt-0.5 h-2 w-48 sm:w-64"
              aria-hidden="true"
            >
              <path
                d="M3 7C78 2 168 2 257 6"
                stroke="#60A5FA"
                strokeWidth="4"
                strokeLinecap="round"
                strokeOpacity="0.65"
              />
            </svg>
            <p className="mt-1 text-xs font-medium text-slate-600 sm:text-sm">
              Library operations overview and system status
            </p>
          </div>

          {/* Live System Status Card (Right Side of Banner) */}
          <div className="flex flex-col gap-2 rounded-2xl border border-white/90 bg-white/90 px-4 py-3 shadow-xs backdrop-blur-md sm:min-w-[245px]">
            <BannerConnectionPill label="Backend API" online={backendOnline} />
            <div className="h-px bg-slate-100" />
            <BannerConnectionPill
              label="RFID Middleware"
              online={rfidOnline}
              subLabel={rfidBufferedMode ? "Buffered" : undefined}
            />
            {backendOnline && (
              <div className="flex items-center justify-between pt-0.5 text-[10px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <Database className="size-3 text-[#2563EB]" />
                  <span>Database</span>
                </span>
                <span className="font-semibold text-slate-700">
                  {databaseConnected ? "Neon PostgreSQL Connected" : "Degraded"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* KPI CARDS — ROW 1 & ROW 2 (8 INSTITUTIONAL METRICS)                   */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isKpiLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Books"
              value={totalBooksStr}
              icon={BookOpen}
              variant="default"
              trend={{ value: 2.4 }}
            />
            <StatCard
              label="Active Members"
              value={totalMembersStr}
              icon={Users}
              variant="success"
              trend={{ value: 1.1 }}
            />
            <StatCard
              label="Active Loans"
              value={totalLoansStr}
              icon={ArrowLeftRight}
              variant="indigo"
            />
            <StatCard
              label="RFID Tagged"
              value={rfidTaggedStr}
              icon={Tag}
              variant="amber"
            />
            <StatCard
              label="Overdue Loans"
              value={overdueLoansStr}
              icon={Clock}
              variant="danger"
            />
            <StatCard
              label="Pending Fines"
              value={pendingFinesStr}
              icon={Coins}
              variant="warning"
            />
            <StatCard
              label="RFID Devices"
              value={rfidDevicesStr}
              icon={Cpu}
              variant="sky"
            />
            <StatCard
              label="Gate Clearances"
              value={gateClearancesStr}
              icon={ShieldCheck}
              variant="success"
            />
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* ANALYTICS CHARTS ROW (3 CARDS: WEEKLY CIRCULATION, RFID, CATEGORY)    */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 1. Weekly Circulation */}
        <Card className="lg:col-span-4 xl:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-[#2563EB]" />
                <CardTitle className="text-sm font-bold text-[#0F172A]">
                  Weekly Circulation
                </CardTitle>
              </div>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#2563EB]" />
                  Issues
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#16A34A]" />
                  Returns
                </span>
              </div>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Issues vs returns this week
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={195}>
              <AreaChart
                data={weeklyCirculation}
                margin={{ top: 8, right: 8, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="issuesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="returnsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="issues"
                  stroke="#2563EB"
                  strokeWidth={2.4}
                  fill="url(#issuesFill)"
                  name="Issues"
                />
                <Area
                  type="monotone"
                  dataKey="returns"
                  stroke="#16A34A"
                  strokeWidth={2.4}
                  fill="url(#returnsFill)"
                  name="Returns"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 2. RFID Event Activity */}
        <Card className="lg:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[#2563EB]" />
              <CardTitle className="text-sm font-bold text-[#0F172A]">
                RFID Event Activity
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Events by hour (today)
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <ResponsiveContainer width="100%" height={195}>
              <BarChart
                data={RFID_EVENTS}
                margin={{ top: 8, right: 4, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="rfidBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10, fill: "#475569" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#475569" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 12,
                    border: "1px solid #E2E8F0",
                  }}
                />
                <Bar
                  dataKey="events"
                  fill="url(#rfidBarGrad)"
                  radius={[5, 5, 0, 0]}
                  name="Events"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 3. Collection By Category */}
        <Card className="overflow-hidden lg:col-span-4 xl:col-span-4">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="size-4 text-[#2563EB]" />
              <CardTitle className="text-sm font-bold text-[#0F172A]">
                By Category
              </CardTitle>
            </div>
            <CardDescription className="text-xs text-slate-500">
              Collection distribution
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="flex min-w-0 flex-col items-center gap-3 sm:flex-row">
              <div className="relative h-[136px] w-[136px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      paddingAngle={3}
                    >
                      {categoryDistribution.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Donut Total Label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-lg font-extrabold leading-none text-[#0F172A]">
                    {totalBooksStr}
                  </span>
                  <span className="mt-0.5 text-[10px] font-medium text-slate-500">
                    Books
                  </span>
                </div>
              </div>

              {/* Category Legend List (Bounded inside card with min-w-0) */}
              <div className="flex min-w-0 flex-1 flex-col gap-2.5 overflow-hidden text-xs">
                {categoryDistribution.slice(0, 4).map((cat: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex min-w-0 items-center justify-between gap-2"
                    title={`${cat.name} (${cat.percent}%)`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="truncate font-semibold text-slate-700">
                        {cat.name}
                      </span>
                    </div>
                    <span className="shrink-0 font-bold tabular-nums text-slate-500">
                      ({cat.percent}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ===================================================================== */}
      {/* BOTTOM ROW: RECENT LOANS + QUICK ACTIONS                              */}
      {/* ===================================================================== */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Recent Loans Card */}
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookOpen className="size-4 text-[#2563EB]" />
                <div>
                  <CardTitle className="text-sm font-bold text-[#0F172A]">
                    Recent Loans
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Latest circulation transactions
                  </CardDescription>
                </div>
              </div>
              <Link
                to="/circulation"
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-[#2563EB]"
              >
                <span>View All</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isKpiLoading ? (
              <div className="flex flex-col gap-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : recentLoansList.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">
                No recent circulation transactions recorded
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentLoansList.slice(0, 5).map((loan: any, idx: number) => {
                  const bookTitle =
                    loan.bookCopy?.book?.title ?? loan.item?.title ?? "Unknown Title";
                  const borrowerName =
                    loan.member?.name ??
                    (loan.member?.firstName
                      ? `${loan.member.firstName} ${loan.member.lastName}`
                      : loan.memberId);
                  const coverGrad = BOOK_THUMB_COLORS[idx % BOOK_THUMB_COLORS.length];

                  return (
                    <div
                      key={loan.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-1 last:pb-0"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        {/* Stylized Book Spine Thumbnail */}
                        <div
                          className={`flex h-10 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${coverGrad} text-white shadow-xs`}
                        >
                          <BookOpen className="size-4 opacity-90" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-[#0F172A]">
                            {bookTitle}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {borrowerName} • Due {formatDateTime(loan.dueDate)}
                          </p>
                        </div>
                      </div>
                      <LoanStatusBadge status={loan.status} />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions Card */}
        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Zap className="size-4 text-[#2563EB]" />
              <div>
                <CardTitle className="text-sm font-bold text-[#0F172A]">
                  Quick Actions
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Direct shortcuts to core library workflows
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {quickActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className="group flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-[#F8FAFC] px-2.5 py-3.5 text-center transition-all duration-150 hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50/70 hover:shadow-xs"
                  >
                    <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-[#2563EB] transition-colors group-hover:bg-[#2563EB] group-hover:text-white">
                      <ActionIcon className="size-4.5" />
                    </div>
                    <span className="text-xs font-bold leading-tight text-[#0F172A]">
                      {action.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
