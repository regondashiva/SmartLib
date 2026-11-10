import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Search,
  Eye,
  Users,
  UserCheck,
  UserX,
  CreditCard,
  BookOpen,
  Upload,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberStatusBadge } from "@/components/ui/status-badge";
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
import { apiGet } from "@/lib/api";
import { formatDate, getInitials } from "@/lib/utils";
import type { PaginatedResponse, Member } from "@/types";

const MEMBER_TYPE_LABELS: Record<string, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  RESEARCH_SCHOLAR: "Research Scholar",
  STAFF: "Staff",
  GUEST: "Guest",
};

const AVATAR_STYLES = [
  "bg-[#DBEAFE] text-[#1D4ED8]",
  "bg-[#EDE9FE] text-[#6D28D9]",
  "bg-[#DCFCE7] text-[#15803D]",
  "bg-[#FEF3C7] text-[#B45309]",
  "bg-[#E0E7FF] text-[#4338CA]",
  "bg-[#FCE7F3] text-[#BE185D]",
];

export default function MembersPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [departmentFilter, setDepartmentFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["members", page, limit, search],
    queryFn: () =>
      apiGet<PaginatedResponse<Member>>("/members", {
        page,
        limit,
        ...(search ? { search } : {}),
      }),
    staleTime: 60_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const handleReset = () => {
    setSearchInput("");
    setSearch("");
    setTypeFilter("ALL");
    setDepartmentFilter("ALL");
    setStatusFilter("ALL");
    setPage(1);
  };

  // Harmonize data payload from both { data: items } or { data: { items: [...] } }
  const members: any[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).data?.items)) return (data as any).data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }, [data]);

  const totalMembers: number = useMemo(() => {
    if (!data) return members.length;
    return (
      (data as any).meta?.total ??
      data.pagination?.total ??
      (data as any).data?.meta?.total ??
      members.length
    );
  }, [data, members]);

  const totalPages: number = useMemo(() => {
    if (!data) return 1;
    return Math.max(
      1,
      (data as any).meta?.totalPages ??
        data.pagination?.totalPages ??
        (data as any).data?.meta?.totalPages ??
        Math.ceil(totalMembers / limit)
    );
  }, [data, totalMembers, limit]);

  const availableDepartments = useMemo(() => {
    const depts = new Set<string>([
      "Computer Science",
      "Information Technology",
      "Computer Engineering",
      "Software Engineering",
      "Electronics & Communication",
      "Data Science",
    ]);
    members.forEach((m) => {
      const d = m.department || m.dept;
      if (d && typeof d === "string" && d.trim()) {
        depts.add(d.trim());
      }
    });
    return Array.from(depts);
  }, [members]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (typeFilter !== "ALL" && m.memberType !== typeFilter) return false;
      const dept = m.department || m.dept || "";
      if (
        departmentFilter !== "ALL" &&
        dept.toLowerCase() !== departmentFilter.toLowerCase()
      ) {
        return false;
      }
      if (statusFilter !== "ALL" && m.status !== statusFilter) return false;
      if (searchInput && !search) {
        const q = searchInput.toLowerCase();
        const matchName = (m.name || m.fullName || `${m.firstName || ""} ${m.lastName || ""}`)
          .toLowerCase()
          .includes(q);
        const matchNum = (m.membershipNumber || m.cardNumber || m.id || "")
          .toLowerCase()
          .includes(q);
        const matchEmail = (m.email || "").toLowerCase().includes(q);
        const matchDept = dept.toLowerCase().includes(q);
        if (!matchName && !matchNum && !matchEmail && !matchDept) return false;
      }
      return true;
    });
  }, [members, typeFilter, departmentFilter, statusFilter, searchInput, search]);

  const activeCount = useMemo(
    () => members.filter((m) => m.status === "ACTIVE").length,
    [members]
  );
  const blockedCount = useMemo(
    () =>
      members.filter(
        (m) => m.status === "BLOCKED" || m.status === "SUSPENDED"
      ).length,
    [members]
  );
  const activeLoansSum = useMemo(
    () =>
      members.reduce(
        (sum, m) =>
          sum + (m.currentLoans ?? m.activeLoansCount ?? m.activeLoans ?? 0),
        0
      ),
    [members]
  );

  const startRecord =
    filteredMembers.length === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(
    totalMembers,
    (page - 1) * limit + filteredMembers.length
  );

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start < maxButtons - 1) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      {/* Page Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100/80 bg-gradient-to-r from-[#EFF6FF] via-[#F8FAFC] to-[#E0F2FE] px-5 py-4 shadow-xs sm:px-6">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <nav
              aria-label="Breadcrumb"
              className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <Link to="/" className="transition-colors hover:text-[#2563EB]">
                Dashboard
              </Link>
              <span className="text-slate-400">&gt;</span>
              <span className="font-semibold text-[#2563EB]">Members</span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
              Members
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">
              Manage institutional patron profiles, smart-card credentials, borrowing limits, and account status.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-slate-200 bg-white px-4 font-semibold text-[#0F172A] shadow-2xs hover:bg-slate-50"
              asChild
            >
              <Link to="/migration">
                <Upload className="size-4 text-slate-700" />
                Import Patrons
              </Link>
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-xl bg-[#2563EB] px-4 font-semibold text-white shadow-sm hover:bg-[#1D4ED8]"
              asChild
            >
              <Link to="/circulation">
                <BookOpen className="size-4" />
                Circulation Desk
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4 Patron KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]">
              <Users className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Total Registered Members
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {isLoading ? "..." : totalMembers.toLocaleString()}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                <TrendingUp className="size-3" />
                +4.2% vs last month
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F0FDF4] text-[#16A34A]">
              <UserCheck className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Active Members (Current)
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {isLoading ? "..." : activeCount.toLocaleString()}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                <TrendingUp className="size-3" />
                +3.9% vs last month
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#FEF2F2] text-[#DC2626]">
              <UserX className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Blocked / Suspended
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {isLoading ? "..." : blockedCount.toLocaleString()}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#DC2626]">
                <TrendingUp className="size-3" />
                +0.8% vs last month
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#F5F3FF] text-[#7C3AED]">
              <CreditCard className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-600">
                Active Loans Held
              </p>
              <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-[#0F172A] tabular-nums">
                {isLoading ? "..." : activeLoansSum.toLocaleString()}
              </p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#16A34A]">
                <TrendingUp className="size-3" />
                +6.1% vs last month
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter Toolbar Card */}
      <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
        <CardContent className="p-3.5">
          <form
            onSubmit={handleSearch}
            className="flex flex-wrap items-center gap-2.5"
          >
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by patron name, membership card no., email or department..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 min-w-0 rounded-xl border-slate-200 bg-[#F8FAFC] pl-10 text-xs focus:bg-white"
              />
            </div>

            <select
              aria-label="Filter by member category"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 min-w-[130px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              <option value="STUDENT">Student</option>
              <option value="FACULTY">Faculty</option>
              <option value="RESEARCH_SCHOLAR">Research Scholar</option>
              <option value="STAFF">Staff</option>
              <option value="GUEST">Guest</option>
            </select>

            <select
              aria-label="Filter by department"
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="h-9 min-w-[140px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="ALL">All Departments</option>
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by member status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 min-w-[120px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="BLOCKED">Blocked</option>
              <option value="EXPIRED">Expired</option>
              <option value="SUSPENDED">Suspended</option>
            </select>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="submit"
                size="sm"
                className="h-9 rounded-xl bg-[#2563EB] px-4 text-xs font-semibold text-white hover:bg-[#1D4ED8]"
              >
                <Search className="size-3.5" />
                Search
              </Button>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleReset}
                className="h-9 rounded-xl border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <RotateCcw className="size-3.5" />
                Reset
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Members Data Table Card */}
      <Card className="overflow-hidden rounded-2xl border-slate-200/90 bg-white shadow-xs">
        <CardContent className="p-0">
          {isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : isLoading ? (
            <div className="flex flex-col gap-2.5 p-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="No members found"
                message={
                  search || searchInput
                    ? `No patron records matched "${search || searchInput}"`
                    : "No members registered yet"
                }
              />
            </div>
          ) : (
            <>
              <div className="w-full max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-200/80 bg-[#F8FAFC]">
                      <TableHead className="py-3.5 pl-6 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Membership No.
                      </TableHead>
                      <TableHead className="py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Patron Name
                      </TableHead>
                      <TableHead className="py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Category
                      </TableHead>
                      <TableHead className="py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Department
                      </TableHead>
                      <TableHead className="py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Status
                      </TableHead>
                      <TableHead className="py-3.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Expiry Date
                      </TableHead>
                      <TableHead className="py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Active Loans
                      </TableHead>
                      <TableHead className="py-3.5 pr-6 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member, idx) => {
                      const avatarStyle =
                        AVATAR_STYLES[idx % AVATAR_STYLES.length];
                      const memberNumber =
                        member.membershipNumber ||
                        member.cardNumber ||
                        member.card_number ||
                        member.membership_number ||
                        (member.id ? `M-${member.id.slice(0, 6)}` : "M-0001");
                      const memberName =
                        member.fullName ||
                        member.name ||
                        `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
                        member.email?.split("@")[0] ||
                        "Institutional Patron";
                      const memberEmail = member.email || "";
                      const memberDepartment =
                        member.department || member.dept || "—";
                      const memberLoans =
                        member.currentLoans ??
                        member.activeLoansCount ??
                        member.activeLoans ??
                        0;

                      return (
                        <TableRow
                          key={member.id || idx}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50/70"
                        >
                          <TableCell className="pl-6 font-bold text-[#2563EB] whitespace-nowrap">
                            {memberNumber}
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div
                                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarStyle}`}
                              >
                                {getInitials(memberName)}
                              </div>
                              <div className="min-w-0">
                                <p
                                  className="truncate font-bold text-[#0F172A]"
                                  title={memberName}
                                >
                                  {memberName}
                                </p>
                                {memberEmail && (
                                  <p
                                    className="truncate text-xs text-slate-500"
                                    title={memberEmail}
                                  >
                                    {memberEmail}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <span className="inline-flex items-center rounded-full border border-slate-200/80 bg-slate-100/90 px-3 py-1 text-xs font-semibold text-slate-700">
                              {MEMBER_TYPE_LABELS[member.memberType] ??
                                member.memberType ??
                                "Student"}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                            {memberDepartment}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <MemberStatusBadge status={member.status} />
                          </TableCell>
                          <TableCell className="font-medium text-slate-700 whitespace-nowrap">
                            {member.expiryDate
                              ? formatDate(member.expiryDate)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center font-bold tabular-nums text-[#0F172A] whitespace-nowrap">
                            {memberLoans}
                          </TableCell>
                          <TableCell className="pr-6 text-right whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-xl border-slate-200 bg-white px-3 text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
                              asChild
                            >
                              <Link to={`/members/${member.id}`}>
                                <Eye className="size-3.5 text-slate-600" />
                                <span>Profile</span>
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Table Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 bg-white px-6 py-3.5 text-xs text-slate-600">
                <span className="font-medium">
                  Showing {startRecord} – {endRecord} of{" "}
                  {totalMembers.toLocaleString()} members
                </span>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Rows per page:</span>
                    <select
                      aria-label="Rows per page"
                      value={limit}
                      onChange={(e) => {
                        setLimit(Number(e.target.value));
                        setPage(1);
                      }}
                      className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:outline-none"
                    >
                      <option value={6}>6</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    {pageNumbers.map((pageNum) => (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setPage(pageNum)}
                        className={`flex size-8 items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                          page === pageNum
                            ? "bg-[#2563EB] text-white shadow-xs"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="flex size-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
