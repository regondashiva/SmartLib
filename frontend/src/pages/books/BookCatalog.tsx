import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  Search,
  Plus,
  Eye,
  BookOpen,
  Layers,
  CheckCircle2,
  FolderKanban,
  LayoutGrid,
  List,
  Tag,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { apiGet } from "@/lib/api";
import type { PaginatedResponse, Book } from "@/types";

const COVER_GRADIENTS = [
  "from-[#1D4ED8] to-[#2563EB]",
  "from-[#0D9488] to-[#14B8A6]",
  "from-[#7C3AED] to-[#8B5CF6]",
  "from-[#0284C7] to-[#38BDF8]",
  "from-[#D97706] to-[#F59E0B]",
];

export function getBookAuthors(b: any): string {
  if (Array.isArray(b.authors) && b.authors.length > 0) {
    return b.authors.join(", ");
  }
  if (typeof b.author === "string" && b.author.trim()) {
    return b.author;
  }
  return "Institutional Author";
}

export function getBookIsbn(b: any): string {
  return b.isbn13 || b.isbn10 || b.isbn || "—";
}

export function getBookCategory(b: any): string {
  if (typeof b.category === "object" && b.category?.name) {
    return b.category.name;
  }
  if (typeof b.category === "string" && b.category.trim()) {
    return b.category;
  }
  if (b.categoryName) return b.categoryName;
  return "General";
}

export function getBookTotalCopies(b: any): number {
  if (typeof b.copiesCount?.total === "number") return b.copiesCount.total;
  if (typeof b.totalCopies === "number") return b.totalCopies;
  if (Array.isArray(b.copies)) return b.copies.length;
  return 1;
}

export function getBookAvailableCopies(b: any): number {
  if (typeof b.copiesCount?.available === "number") return b.copiesCount.available;
  if (typeof b.availableCopies === "number") return b.availableCopies;
  if (Array.isArray(b.copies)) {
    return b.copies.filter((c: any) => c.status === "AVAILABLE" && !c.isReferenceOnly).length;
  }
  return 0;
}

export default function BookCatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "AVAILABLE" | "UNAVAILABLE">("ALL");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["books", page, search],
    queryFn: () =>
      apiGet<PaginatedResponse<Book>>("/books", {
        page,
        limit,
        ...(search ? { search } : {}),
      }),
    staleTime: 60_000,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearchParams(search ? { q: search } : {});
  };

  const books: any[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray((data as any).items)) return (data as any).items;
    if (Array.isArray((data as any).data?.items)) return (data as any).data.items;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }, [data]);

  const totalBooks =
    (data as any)?.meta?.total ??
    data?.pagination?.total ??
    (data as any)?.data?.meta?.total ??
    books.length;

  const totalPages = Math.max(
    1,
    (data as any)?.meta?.totalPages ??
      data?.pagination?.totalPages ??
      (data as any)?.data?.meta?.totalPages ??
      1
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      const catName = getBookCategory(b);
      if (catName && catName !== "General") set.add(catName);
    });
    return Array.from(set);
  }, [books]);

  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const catName = getBookCategory(b);
      if (categoryFilter !== "ALL" && catName !== categoryFilter) return false;
      const avail = getBookAvailableCopies(b);
      if (availabilityFilter === "AVAILABLE" && avail <= 0) return false;
      if (availabilityFilter === "UNAVAILABLE" && avail > 0) return false;
      return true;
    });
  }, [books, categoryFilter, availabilityFilter]);

  const totalCopiesCount = useMemo(
    () => books.reduce((sum, b) => sum + getBookTotalCopies(b), 0),
    [books]
  );
  const availableCopiesCount = useMemo(
    () => books.reduce((sum, b) => sum + getBookAvailableCopies(b), 0),
    [books]
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Book Catalog"
        description="Browse, filter, and manage bibliographic titles and physical copy availability across the institution"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Book Catalog" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/rfid/tagging">
                <Tag className="size-4 text-[#0D9488]" />
                RFID Tagging
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/cataloguing">
                <Plus className="size-4" />
                Add Book
              </Link>
            </Button>
          </div>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Bibliographic Titles"
          value={isLoading ? "..." : totalBooks.toLocaleString()}
          icon={BookOpen}
          variant="default"
        />
        <StatCard
          label="Total Copies (Current View)"
          value={isLoading ? "..." : totalCopiesCount.toLocaleString()}
          icon={Layers}
          variant="indigo"
        />
        <StatCard
          label="Available for Loan"
          value={isLoading ? "..." : availableCopiesCount.toLocaleString()}
          icon={CheckCircle2}
          variant="success"
        />
        <StatCard
          label="Subject Categories"
          value={isLoading ? "..." : Math.max(categories.length, 1)}
          icon={FolderKanban}
          variant="rfid"
        />
      </div>

      {/* Search & Advanced Filter Toolbar */}
      <Card>
        <CardContent className="p-4">
          <form
            onSubmit={handleSearch}
            className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              <div className="relative min-w-[220px] flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search by title, author, ISBN-13, publisher or subject…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>

              <select
                aria-label="Filter by category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-[#2563EB] focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter by availability"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                className="h-9 shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 focus:border-[#2563EB] focus:outline-none"
              >
                <option value="ALL">All Availability</option>
                <option value="AVAILABLE">Available Copies Only</option>
                <option value="UNAVAILABLE">All Copies Checked Out</option>
              </select>

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" className="h-9 px-4 text-xs font-semibold">
                  Search
                </Button>
                {(search || categoryFilter !== "ALL" || availabilityFilter !== "ALL") && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setSearch("");
                      setCategoryFilter("ALL");
                      setAvailabilityFilter("ALL");
                      setPage(1);
                      setSearchParams({});
                    }}
                    className="h-9 px-3 text-xs"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Table vs Grid Toggle */}
            <div className="flex shrink-0 items-center gap-1 self-end rounded-xl border border-slate-200 bg-slate-50 p-1 lg:self-auto">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "table"
                    ? "bg-white text-[#2563EB] shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <List className="size-3.5" />
                Table
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  viewMode === "grid"
                    ? "bg-white text-[#2563EB] shadow-2xs"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <LayoutGrid className="size-3.5" />
                Grid
              </button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Catalog Content */}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <Card>
          <CardContent className="flex flex-col gap-2.5 p-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-11 w-full rounded-xl" />
            ))}
          </CardContent>
        </Card>
      ) : filteredBooks.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={BookOpen}
              title="No books found"
              message={
                search
                  ? `No catalog records matched "${search}"`
                  : "Start adding books to your institutional catalog"
              }
            />
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBooks.map((book, idx) => {
            const avail = getBookAvailableCopies(book);
            const total = getBookTotalCopies(book);
            const grad = COVER_GRADIENTS[idx % COVER_GRADIENTS.length];
            const catName = getBookCategory(book);
            const author = getBookAuthors(book);
            const isbn = getBookIsbn(book);

            return (
              <Card
                key={book.id || idx}
                className="flex flex-col justify-between overflow-hidden hover:border-blue-300"
              >
                <CardContent className="p-5">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm`}
                    >
                      <BookOpen className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Badge variant="secondary" className="mb-1.5 text-[10px]">
                        {catName}
                      </Badge>
                      <h3 className="line-clamp-2 text-sm font-bold text-[#0F172A]" title={book.title}>
                        {book.title}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-xs text-slate-500" title={author}>
                        {author}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="identifier text-slate-500 font-mono truncate max-w-[120px]">
                      {isbn}
                    </span>
                    <Badge variant={avail > 0 ? "success" : "destructive"} className="shrink-0">
                      {avail} / {total} Available
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <Link to={`/books/${book.id}`}>
                        <Eye className="size-3.5" />
                        View Record & Copies
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="py-3 pl-5 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      Book Title
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      Author
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      ISBN
                    </TableHead>
                    <TableHead className="py-3 text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      Category
                    </TableHead>
                    <TableHead className="py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      Total Copies
                    </TableHead>
                    <TableHead className="py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      Availability
                    </TableHead>
                    <TableHead className="py-3 pr-5 text-right text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBooks.map((book, idx) => {
                    const avail = getBookAvailableCopies(book);
                    const total = getBookTotalCopies(book);
                    const grad = COVER_GRADIENTS[idx % COVER_GRADIENTS.length];
                    const author = getBookAuthors(book);
                    const isbn = getBookIsbn(book);
                    const catName = getBookCategory(book);

                    return (
                      <TableRow key={book.id || idx}>
                        <TableCell className="min-w-[220px] max-w-md font-medium pl-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-9 w-7 shrink-0 items-center justify-center rounded-md bg-gradient-to-br ${grad} text-white shadow-2xs`}
                            >
                              <BookOpen className="size-3.5" />
                            </div>
                            <span
                              className="line-clamp-1 font-bold text-[#0F172A]"
                              title={book.title}
                            >
                              {book.title}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-[140px] max-w-[200px] text-slate-600">
                          <span className="line-clamp-1" title={author}>
                            {author}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs">
                          {isbn !== "—" ? (
                            <span className="identifier text-slate-700">{isbn}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {catName ? (
                            <Badge variant="secondary">{catName}</Badge>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums whitespace-nowrap">
                          {total}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Badge variant={avail > 0 ? "success" : "destructive"}>
                            {avail > 0 ? `${avail} Available` : "Checked Out"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-5 text-right whitespace-nowrap">
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/books/${book.id}`}>
                              <Eye className="size-3.5" />
                              <span>Details</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!isLoading && !isError && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white px-5 py-3 text-xs text-slate-600 shadow-2xs">
          <span>
            Page <strong className="text-[#0F172A]">{page}</strong> of{" "}
            <strong className="text-[#0F172A]">{totalPages}</strong> (
            {totalBooks.toLocaleString()} total titles)
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
    </div>
  );
}
