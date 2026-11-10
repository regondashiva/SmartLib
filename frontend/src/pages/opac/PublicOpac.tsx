import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Filter,
  Globe,
  Sparkles,
  Trash2,
  Plus,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api as apiClient } from "@/lib/api";

interface OpacBookItem {
  id: string;
  title: string;
  subtitle?: string;
  isbn13?: string;
  edition?: string;
  publicationYear?: number;
  callNumber?: string;
  language: string;
  description?: string;
  category: string;
  subject: string;
  publisher: string;
  authors: string[];
  availabilityStatus: "AVAILABLE" | "REFERENCE_ONLY" | "ALL_COPIES_CHECKED_OUT";
  copiesSummary: {
    totalCopies: number;
    availableForLoan: number;
    referenceOnlyCopies: number;
    shelfLocations: string[];
  };
  relevanceScore: number;
}

interface OpacBookDetail extends OpacBookItem {
  copies: Array<{
    accessionNumber: string;
    status: string;
    condition: string;
    isReferenceOnly: boolean;
    shelfLocation: string;
  }>;
  relatedBooks: Array<{
    id: string;
    title: string;
    isbn13?: string;
    authors: string[];
    category: string;
    publicationYear?: number;
  }>;
}

export default function PublicOpacPage() {
  const [activeTab, setActiveTab] = useState<"OPAC" | "BOOKSHELF" | "NET_CATALOGUING">("OPAC");
  const [query, setQuery] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"ALL" | "AVAILABLE_ONLY">("ALL");
  const [sortBy, setSortBy] = useState<"RELEVANCE" | "TITLE_ASC" | "YEAR_DESC" | "RECENT">(
    "RELEVANCE"
  );

  const [books, setBooks] = useState<OpacBookItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<OpacBookDetail | null>(null);

  // Virtual Bookshelf state
  const [personalShelf, setPersonalShelf] = useState<
    Array<{
      bookId: string;
      title: string;
      authors: string[];
      category: string;
      available: boolean;
      shelfName: string;
    }>
  >([]);
  const [shelfMessage, setShelfMessage] = useState("");

  // Net Cataloguing state
  const [netIsbn, setNetIsbn] = useState("9780134685991");
  const [netPreview, setNetPreview] = useState<{
    metadata: {
      title: string;
      subtitle?: string;
      isbn13: string;
      authors: string[];
      publisherName: string;
      publicationYear: number;
      edition: string;
      subject: string;
      callNumber: string;
      sourceProvider: string;
      providerMode: string;
    };
    duplicateExists: boolean;
  } | null>(null);

  const executeOpacSearch = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/opac/search", {
        params: {
          q: query || undefined,
          author: authorFilter || undefined,
          category: categoryFilter || undefined,
          availability: availabilityFilter,
          sort: sortBy,
          limit: 24,
        },
      });
      setBooks(res.data?.data || []);
    } catch {
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const openBookDetail = async (id: string) => {
    try {
      const res = await apiClient.get(`/opac/books/${id}`);
      setSelectedBook(res.data?.data || null);
    } catch {
      // ignore
    }
  };

  const loadPersonalShelf = async () => {
    try {
      const res = await apiClient.get("/opac/bookshelf/personal");
      setPersonalShelf(res.data?.data?.items || []);
    } catch {
      setPersonalShelf([]);
    }
  };

  const addToShelf = async (bookId: string) => {
    try {
      const res = await apiClient.post("/opac/bookshelf/personal", {
        bookId,
        shelfName: "My Reading List",
      });
      setPersonalShelf(res.data?.data?.items || []);
      setShelfMessage("Added to your personal Virtual Bookshelf");
    } catch {
      setShelfMessage("Sign in as a library user to save to your private Virtual Bookshelf");
    }
  };

  const removeFromShelf = async (bookId: string) => {
    try {
      const res = await apiClient.delete(`/opac/bookshelf/personal/${bookId}`);
      setPersonalShelf(res.data?.data?.items || []);
    } catch {
      // ignore
    }
  };

  const lookupNetCatalog = async () => {
    try {
      const res = await apiClient.get("/opac/net-cataloguing/lookup", {
        params: { isbn: netIsbn },
      });
      setNetPreview(res.data?.data || null);
    } catch {
      setNetPreview(null);
    }
  };

  useEffect(() => {
    executeOpacSearch();
  }, []);

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A] p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Top Enterprise Banner Header */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-blue-200/80 bg-gradient-to-r from-[#071B3A] via-[#0F2952] to-[#1D4ED8] px-6 py-6 text-white shadow-md md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#38BDF8]">
              <Globe className="size-4" />
              Public Online Access Catalogue (OPAC) & Virtual Bookshelf
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              SmartLib Institutional Discovery Portal
            </h1>
            <p className="mt-1 text-xs text-slate-200 sm:text-sm">
              Full-text ranked search across titles, authors, ISBN, subjects, publishers, and shelf availability.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("OPAC")}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "OPAC"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Public OPAC Search
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("BOOKSHELF");
                loadPersonalShelf();
              }}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "BOOKSHELF"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Virtual Bookshelf
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("NET_CATALOGUING")}
              className={`rounded-xl px-4 py-2 text-xs sm:text-sm font-semibold transition ${
                activeTab === "NET_CATALOGUING"
                  ? "bg-white text-[#0F172A] shadow-sm"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              Net Cataloguing
            </button>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              <ArrowLeft className="size-3.5" />
              Staff Login
            </Link>
          </div>
        </div>

        {shelfMessage && (
          <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-[#1D4ED8]">
            <span>{shelfMessage}</span>
            <button
              type="button"
              onClick={() => setShelfMessage("")}
              className="text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: PUBLIC OPAC SEARCH */}
        {activeTab === "OPAC" && (
          <div className="space-y-5">
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <div className="relative md:col-span-2">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="text"
                      aria-label="OPAC Search Query"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by title, author, ISBN, subject, publisher, or accession #..."
                      className="pl-10"
                    />
                  </div>
                  <Input
                    type="text"
                    value={authorFilter}
                    onChange={(e) => setAuthorFilter(e.target.value)}
                    placeholder="Filter by Author..."
                  />
                  <Input
                    type="text"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    placeholder="Filter by Subject / Category..."
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <Filter className="size-3.5 text-[#2563EB]" />
                      Availability:
                      <select
                        value={availabilityFilter}
                        onChange={(e) =>
                          setAvailabilityFilter(e.target.value as "ALL" | "AVAILABLE_ONLY")
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0F172A]"
                      >
                        <option value="ALL">All Holdings</option>
                        <option value="AVAILABLE_ONLY">Available for Loan Only</option>
                      </select>
                    </label>

                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      Sort By:
                      <select
                        value={sortBy}
                        onChange={(e) =>
                          setSortBy(
                            e.target.value as "RELEVANCE" | "TITLE_ASC" | "YEAR_DESC" | "RECENT"
                          )
                        }
                        className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#0F172A]"
                      >
                        <option value="RELEVANCE">Full-Text Relevance Rank</option>
                        <option value="TITLE_ASC">Title (A–Z)</option>
                        <option value="YEAR_DESC">Publication Year (Newest)</option>
                        <option value="RECENT">Recently Added</option>
                      </select>
                    </label>
                  </div>

                  <Button type="button" onClick={executeOpacSearch}>
                    Search Catalogue
                  </Button>
                </div>
              </CardContent>
            </Card>

            {loading ? (
              <div className="py-12 text-center text-sm font-medium text-slate-500">
                Searching institutional holdings...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {books.map((book) => (
                  <Card
                    key={book.id}
                    className="flex flex-col justify-between hover:border-blue-300"
                  >
                    <CardContent className="flex h-full flex-col justify-between space-y-4 p-5">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">{book.category}</Badge>
                          <Badge
                            variant={
                              book.availabilityStatus === "AVAILABLE" ? "success" : "warning"
                            }
                          >
                            {book.availabilityStatus === "AVAILABLE"
                              ? `${book.copiesSummary.availableForLoan} Available`
                              : book.availabilityStatus}
                          </Badge>
                        </div>
                        <h3 className="mt-2.5 text-base font-bold text-[#0F172A]">
                          {book.title}
                        </h3>
                        <p className="mt-1 text-xs text-slate-600">
                          {book.authors.join(", ")} • {book.publisher} (
                          {book.publicationYear || "N/A"})
                        </p>
                        <p className="mt-1 font-mono text-xs text-slate-500">
                          ISBN: {book.isbn13 || "N/A"} | Call #: {book.callNumber || "N/A"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          onClick={() => openBookDetail(book.id)}
                          className="flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline"
                        >
                          <BookOpen className="size-3.5" />
                          View Availability & Details
                        </button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addToShelf(book.id)}
                        >
                          <Plus className="size-3.5" />
                          Save to Shelf
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Book Detail Modal */}
            {selectedBook && (
              <Card className="border-blue-300 shadow-lg">
                <CardHeader className="border-b border-slate-100 bg-blue-50/40 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg font-bold text-[#0F172A]">
                        {selectedBook.title}
                      </CardTitle>
                      <CardDescription>
                        Authors: {selectedBook.authors.join(", ")} | Publisher:{" "}
                        {selectedBook.publisher}
                      </CardDescription>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedBook(null)}
                    >
                      Close Detail
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Physical Copies & Shelf Locations ({selectedBook.copies.length})
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedBook.copies.map((c) => (
                        <div
                          key={c.accessionNumber}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                        >
                          <span className="font-mono font-semibold text-[#0F172A]">
                            {c.accessionNumber} ({c.shelfLocation})
                          </span>
                          <Badge variant="success">{c.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* TAB 2: VIRTUAL BOOKSHELF */}
        {activeTab === "BOOKSHELF" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bookmark className="size-5 text-[#2563EB]" />
                  <CardTitle>Personal Virtual Bookshelf & Reading List</CardTitle>
                </div>
                <span className="text-xs text-slate-500">
                  Isolated per authenticated user account
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {personalShelf.length === 0 ? (
                <p className="py-6 text-sm text-slate-500">
                  Your personal reading list is currently empty. Browse the OPAC and click
                  &quot;Save to Shelf&quot;.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {personalShelf.map((item) => (
                    <div
                      key={item.bookId}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                    >
                      <div>
                        <Badge variant="default">{item.shelfName}</Badge>
                        <h4 className="mt-2 text-sm font-bold text-[#0F172A]">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-500">{item.authors.join(", ")}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                        <Badge variant={item.available ? "success" : "warning"}>
                          {item.available ? "Available Now" : "Checked Out"}
                        </Badge>
                        <button
                          type="button"
                          onClick={() => removeFromShelf(item.bookId)}
                          className="flex items-center gap-1 text-xs font-semibold text-[#DC2626] hover:underline"
                        >
                          <Trash2 className="size-3.5" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: PROVIDER-NEUTRAL NET CATALOGUING */}
        {activeTab === "NET_CATALOGUING" && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-[#2563EB]" />
                <CardTitle>
                  Provider-Neutral Net Cataloguing Adapter (Z39.50 / MARC21 Mock Provider)
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  type="text"
                  value={netIsbn}
                  onChange={(e) => setNetIsbn(e.target.value)}
                  placeholder="Enter 10 or 13 digit ISBN..."
                  className="w-72"
                />
                <Button type="button" onClick={lookupNetCatalog}>
                  Lookup Bibliographic Metadata
                </Button>
              </div>

              {netPreview && (
                <div className="space-y-2 rounded-xl border border-blue-200 bg-blue-50/60 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#1D4ED8]">
                      Source: {netPreview.metadata.sourceProvider} (
                      {netPreview.metadata.providerMode})
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-[#16A34A]">
                      <CheckCircle2 className="size-3.5" />
                      {netPreview.duplicateExists
                        ? "ISBN Already in Catalog"
                        : "Ready for Import"}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-[#0F172A]">
                    {netPreview.metadata.title}
                  </div>
                  <div className="text-slate-700">
                    Authors: {netPreview.metadata.authors.join(", ")} | Publisher:{" "}
                    {netPreview.metadata.publisherName} ({netPreview.metadata.publicationYear})
                  </div>
                  <div className="font-mono text-slate-600">
                    ISBN-13: {netPreview.metadata.isbn13} | Call Number:{" "}
                    {netPreview.metadata.callNumber} | Subject: {netPreview.metadata.subject}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
