import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  BookMarked,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers,
  Tag,
  ArrowRight,
  RefreshCw,
  BarChart2,
  Barcode,
  Sparkles,
  FileText,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiGet, apiPost } from "@/lib/api";
import type { ApiResponse, CreateBookPayload, ItemCondition } from "@/types";

interface CategoryMeta {
  id: string;
  name: string;
  code?: string;
}

interface PublisherMeta {
  id: string;
  name: string;
}

interface AuthorMeta {
  id: string;
  name: string;
}

interface CreatedBookResult {
  id: string;
  title: string;
  isbn13?: string;
  authors: string[];
  copies: Array<{
    id: string;
    accessionNumber: string;
    barcode?: string;
    status: string;
    shelfLocation: string;
  }>;
}

export default function CataloguingPage() {
  const queryClient = useQueryClient();

  // ─── Form State ──────────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [authors, setAuthors] = useState<string[]>([""]);
  const [authorDraft, setAuthorDraft] = useState("");
  const [isbn, setIsbn] = useState("");
  const [isbn10, setIsbn10] = useState("");
  const [edition, setEdition] = useState("");
  const [publisher, setPublisher] = useState("");
  const [publicationYear, setPublicationYear] = useState<number | "">(
    new Date().getFullYear()
  );
  const [category, setCategory] = useState("Computer Science");
  const [classification, setClassification] = useState("");
  const [callNumber, setCallNumber] = useState("");
  const [language, setLanguage] = useState("English");
  const [pageCount, setPageCount] = useState<number | "">("");
  const [description, setDescription] = useState("");

  // Physical copies state
  const [copiesMode, setCopiesMode] = useState<"quick" | "custom">("quick");
  const [copiesCount, setCopiesCount] = useState(1);
  const [shelfLocation, setShelfLocation] = useState("MAIN-STACKS");
  const [copyCondition, setCopyCondition] = useState<ItemCondition>("GOOD");
  const [isReferenceOnly, setIsReferenceOnly] = useState(false);
  const [price, setPrice] = useState<number | "">("");

  // Custom copies list (when in custom mode)
  const [customCopies, setCustomCopies] = useState<
    Array<{
      accessionNumber: string;
      barcode: string;
      shelfLocation: string;
      condition: ItemCondition;
    }>
  >([
    {
      accessionNumber: "",
      barcode: "",
      shelfLocation: "MAIN-STACKS",
      condition: "GOOD",
    },
  ]);

  // Submission feedback
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [createdBook, setCreatedBook] = useState<CreatedBookResult | null>(
    null
  );

  // ─── Metadata Queries ────────────────────────────────────────────────────────
  const { data: categoriesData } = useQuery<ApiResponse<CategoryMeta[]>>({
    queryKey: ["books", "meta", "categories"],
    queryFn: () =>
      apiGet<ApiResponse<CategoryMeta[]>>("/books/meta/categories"),
    staleTime: 5 * 60_000,
  });

  const { data: publishersData } = useQuery<ApiResponse<PublisherMeta[]>>({
    queryKey: ["books", "meta", "publishers"],
    queryFn: () =>
      apiGet<ApiResponse<PublisherMeta[]>>("/books/meta/publishers"),
    staleTime: 5 * 60_000,
  });

  const { data: authorsData } = useQuery<ApiResponse<AuthorMeta[]>>({
    queryKey: ["books", "meta", "authors"],
    queryFn: () => apiGet<ApiResponse<AuthorMeta[]>>("/books/meta/authors"),
    staleTime: 5 * 60_000,
  });

  // ─── Authors Management ──────────────────────────────────────────────────────
  const committedAuthors = authors.map((a) => a.trim()).filter(Boolean);

  const handleAddAuthor = () => {
    if (authorDraft.trim()) {
      const next = [...committedAuthors, authorDraft.trim()];
      setAuthors(next.length > 0 ? next : [""]);
      setAuthorDraft("");
    } else {
      setAuthors([...authors, ""]);
    }
  };

  const handleAuthorChange = (index: number, value: string) => {
    const updated = [...authors];
    updated[index] = value;
    setAuthors(updated);
  };

  const handleRemoveAuthor = (index: number) => {
    if (authors.length > 1) {
      setAuthors(authors.filter((_, i) => i !== index));
    } else {
      setAuthors([""]);
    }
  };

  // ─── Custom Copies Management ────────────────────────────────────────────────
  const handleAddCustomCopy = () => {
    setCustomCopies([
      ...customCopies,
      {
        accessionNumber: "",
        barcode: "",
        shelfLocation: shelfLocation || "MAIN-STACKS",
        condition: "GOOD",
      },
    ]);
  };

  const handleRemoveCustomCopy = (index: number) => {
    if (customCopies.length > 1) {
      setCustomCopies(customCopies.filter((_, i) => i !== index));
    }
  };

  // ─── Client Validation ───────────────────────────────────────────────────────
  const getEffectiveAuthors = () => {
    const list = authors.map((a) => a.trim()).filter(Boolean);
    if (authorDraft.trim()) {
      list.push(authorDraft.trim());
    }
    return list;
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Book title is required.";
    }

    const filteredAuthors = getEffectiveAuthors();
    if (filteredAuthors.length === 0) {
      errors.authors = "At least one author name is required.";
    }

    if (isbn.trim()) {
      const cleanIsbn = isbn.trim().replace(/[-\s]/g, "");
      const isbnRegex = /^(97[89])?\d{9}[\dX]$/;
      if (!isbnRegex.test(cleanIsbn)) {
        errors.isbn = "Invalid ISBN format. Expected valid ISBN-10 or ISBN-13.";
      }
    }

    if (copiesMode === "quick") {
      if (copiesCount < 1 || copiesCount > 50) {
        errors.copiesCount = "Copies count must be between 1 and 50.";
      }
    } else {
      const accNums = customCopies
        .map((c) => c.accessionNumber.trim())
        .filter(Boolean);
      const uniqueAccNums = new Set(accNums);
      if (accNums.length !== uniqueAccNums.size) {
        errors.customCopies =
          "Duplicate accession numbers detected in copies list.";
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Mutation ────────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (payload: CreateBookPayload) =>
      apiPost<ApiResponse<CreatedBookResult>>("/books", payload),
    onSuccess: (res) => {
      setCreatedBook(res.data);
      setServerError(null);
      queryClient.invalidateQueries({ queryKey: ["books"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
    onError: (err: any) => {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An error occurred while creating the book.";
      setServerError(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    const cleanIsbn13 = isbn.trim().replace(/[-\s]/g, "");
    const cleanIsbn10 = isbn10.trim().replace(/[-\s]/g, "");
    const filteredAuthors = getEffectiveAuthors();

    const payload: CreateBookPayload = {
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      isbn13: cleanIsbn13 || undefined,
      isbn10: cleanIsbn10 || undefined,
      edition: edition.trim() || undefined,
      publisherName: publisher.trim() || undefined,
      publicationYear: publicationYear ? Number(publicationYear) : undefined,
      categoryName: category.trim() || undefined,
      classification: classification.trim() || undefined,
      callNumber: callNumber.trim() || undefined,
      description: description.trim() || undefined,
      language: language.trim() || "English",
      pageCount: pageCount ? Number(pageCount) : undefined,
      authors: filteredAuthors,
      shelfLocation: shelfLocation.trim() || "MAIN-STACKS",
      isReferenceOnly,
      condition: copyCondition,
      price: price ? Number(price) : undefined,
    };

    if (copiesMode === "quick") {
      payload.copiesCount = Number(copiesCount);
    } else {
      payload.copies = customCopies.map((c) => ({
        accessionNumber: c.accessionNumber.trim() || undefined,
        barcode: c.barcode.trim() || undefined,
        shelfLocation:
          c.shelfLocation.trim() || shelfLocation || "MAIN-STACKS",
        condition: c.condition,
        status: isReferenceOnly ? "REFERENCE_ONLY" : "AVAILABLE",
        isReferenceOnly,
        price: price ? Number(price) : undefined,
      }));
    }

    createMutation.mutate(payload);
  };

  const handleReset = () => {
    setTitle("");
    setSubtitle("");
    setAuthors([""]);
    setAuthorDraft("");
    setIsbn("");
    setIsbn10("");
    setEdition("");
    setPublisher("");
    setPublicationYear(new Date().getFullYear());
    setCategory("Computer Science");
    setClassification("");
    setCallNumber("");
    setPageCount("");
    setDescription("");
    setCopiesCount(1);
    setPrice("");
    setIsReferenceOnly(false);
    setCustomCopies([
      {
        accessionNumber: "",
        barcode: "",
        shelfLocation: "MAIN-STACKS",
        condition: "GOOD",
      },
    ]);
    setCreatedBook(null);
    setServerError(null);
    setValidationErrors({});
  };

  return (
    <div className="space-y-5">
      {/* Header Banner matching reference image */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100/80 bg-gradient-to-r from-[#EFF6FF] via-[#F8FAFC] to-[#E0F2FE] px-6 py-4 shadow-xs">
        <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-blue-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <nav
              aria-label="Breadcrumb"
              className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500"
            >
              <Link to="/" className="transition-colors hover:text-[#2563EB]">
                Dashboard
              </Link>
              <span className="text-slate-400">&gt;</span>
              <span className="font-semibold text-[#2563EB]">Cataloguing</span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
              Cataloguing & Accessioning
            </h1>
            <p className="mt-0.5 text-xs font-medium text-slate-600 sm:text-sm">
              Institutional MARC21 bibliographic cataloguing, copy accessioning, and RFID provisioning
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-slate-200 bg-white px-4 font-semibold text-[#0F172A] shadow-2xs hover:bg-slate-50"
              asChild
            >
              <Link to="/books">
                <BarChart2 className="size-4 text-slate-700" />
                View Catalog
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {createdBook && (
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/90 text-emerald-950 shadow-xs">
          <CardContent className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#16A34A]" />
              <div>
                <p className="text-sm font-bold">
                  Bibliographic Record Catalogued &{" "}
                  {createdBook.copies.length} Physical Cop
                  {createdBook.copies.length > 1 ? "ies" : "y"} Provisioned
                </p>
                <p className="mt-0.5 text-xs text-emerald-800">
                  <span className="font-semibold">"{createdBook.title}"</span>{" "}
                  has been committed to Neon PostgreSQL.
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {createdBook.copies.map((c) => (
                    <Badge
                      key={c.id}
                      variant="success"
                      className="font-mono text-[11px]"
                    >
                      {c.accessionNumber}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              <Button size="sm" variant="outline" onClick={handleReset}>
                <Plus className="size-3.5" />
                Catalogue Another
              </Button>
              <Button size="sm" asChild>
                <Link to={`/books/${createdBook.id}`}>
                  View Book
                  <ArrowRight className="ml-1 size-3.5" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Server Error Alert */}
      {serverError && (
        <Card className="rounded-2xl border-red-200 bg-red-50/90 text-red-900">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertCircle className="mt-0.5 size-5 shrink-0 text-[#DC2626]" />
            <div>
              <p className="text-sm font-bold">Cataloguing Transaction Error</p>
              <p className="mt-0.5 text-xs text-red-700">{serverError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Left Column (8 cols): Main Bibliographic Entry Form + Physical Inventory */}
          <div className="space-y-5 lg:col-span-8">
            {/* Card 1: Bibliographic Record */}
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                    <BookMarked className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-extrabold text-[#0F172A]">
                      Bibliographic Record
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Descriptive cataloguing and classification metadata
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Title & Subtitle */}
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                      <span>
                        Book Title <span className="text-[#DC2626]">*</span>
                      </span>
                      {validationErrors.title && (
                        <span className="text-[11px] font-medium text-[#DC2626]">
                          {validationErrors.title}
                        </span>
                      )}
                    </label>
                    <Input
                      placeholder="e.g. Clean Code: A Handbook of Agile Software Craftsmanship"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={`h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white ${
                        validationErrors.title ? "border-[#DC2626]" : ""
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Subtitle / Secondary Title
                    </label>
                    <Input
                      placeholder="e.g. Principles, Practices, and Patterns for Professional Software Development"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Authors / Creators Row matching reference image */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                    <span>
                      Authors / Creators{" "}
                      <span className="text-[#DC2626]">*</span>
                    </span>
                    {validationErrors.authors && (
                      <span className="text-[11px] font-medium text-[#DC2626]">
                        {validationErrors.authors}
                      </span>
                    )}
                  </label>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-h-9 flex-1 flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 focus-within:border-[#2563EB] focus-within:bg-white">
                      {authors.map((authorName, index) =>
                        authorName.trim() && authors.length > 1 ? (
                          <span
                            key={index}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F172A] shadow-2xs"
                          >
                            <button
                              type="button"
                              onClick={() => handleRemoveAuthor(index)}
                              className="text-slate-400 hover:text-[#DC2626]"
                              aria-label={`Remove ${authorName}`}
                            >
                              <X className="size-3" />
                            </button>
                            {authorName}
                          </span>
                        ) : null
                      )}

                      <input
                        type="text"
                        placeholder={
                          authors.length === 1 && !authors[0]
                            ? "Author 1 (e.g. Robert C. Martin)"
                            : "Add another author..."
                        }
                        value={
                          authors.length === 1
                            ? authors[0]
                            : authorDraft
                        }
                        onChange={(e) => {
                          if (authors.length === 1) {
                            handleAuthorChange(0, e.target.value);
                          } else {
                            setAuthorDraft(e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAuthor();
                          }
                        }}
                        list="authors-datalist"
                        className="min-w-[180px] flex-1 bg-transparent px-1 py-0.5 text-xs font-medium text-[#0F172A] placeholder:text-slate-400 focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (authors.length === 1 && authors[0]?.trim()) {
                          setAuthors([authors[0].trim(), ""]);
                        } else {
                          handleAddAuthor();
                        }
                      }}
                      className="inline-flex h-9 items-center gap-1 px-2.5 text-xs font-bold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
                    >
                      <Plus className="size-3.5" />
                      Add Author
                    </button>
                  </div>

                  {/* Additional Author Input rows when multiple open inputs exist */}
                  {authors.length > 1 &&
                    authors.map((authorName, index) => (
                      <div key={index} className="flex items-center gap-2 pt-1">
                        <Input
                          placeholder={`Author ${index + 1} (e.g. Robert C. Martin)`}
                          value={authorName}
                          onChange={(e) =>
                            handleAuthorChange(index, e.target.value)
                          }
                          list="authors-datalist"
                          className="h-8 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveAuthor(index)}
                          className="size-8 shrink-0 text-slate-400 hover:text-[#DC2626]"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}

                  <datalist id="authors-datalist">
                    {authorsData?.data?.map((a) => (
                      <option key={a.id} value={a.name} />
                    ))}
                  </datalist>
                </div>

                {/* 2-Column Metadata Grid matching reference image */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-xs font-bold text-[#0F172A]">
                      <span>ISBN-13</span>
                      {validationErrors.isbn && (
                        <span className="text-[11px] font-medium text-[#DC2626]">
                          {validationErrors.isbn}
                        </span>
                      )}
                    </label>
                    <Input
                      placeholder="e.g. 9780132350884"
                      value={isbn}
                      onChange={(e) => setIsbn(e.target.value)}
                      className={`h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white ${
                        validationErrors.isbn ? "border-[#DC2626]" : ""
                      }`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      ISBN-10
                    </label>
                    <Input
                      placeholder="e.g. 0132350882"
                      value={isbn10}
                      onChange={(e) => setIsbn10(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Publisher
                    </label>
                    <Input
                      placeholder="e.g. Prentice Hall"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      list="publishers-datalist"
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                    <datalist id="publishers-datalist">
                      {publishersData?.data?.map((p) => (
                        <option key={p.id} value={p.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Subject Category
                    </label>
                    <Input
                      placeholder="e.g. Computer Science"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      list="categories-datalist"
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                    <datalist id="categories-datalist">
                      {categoriesData?.data?.map((c) => (
                        <option key={c.id} value={c.name} />
                      ))}
                    </datalist>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      DDC / Classification Code
                    </label>
                    <Input
                      placeholder="e.g. 005.1"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Call Number
                    </label>
                    <Input
                      placeholder="e.g. QA76.76.C69 M37 2008"
                      value={callNumber}
                      onChange={(e) => setCallNumber(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Edition Statement
                    </label>
                    <Input
                      placeholder="e.g. 1st Edition"
                      value={edition}
                      onChange={(e) => setEdition(e.target.value)}
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Publication Year
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 2008"
                      value={publicationYear}
                      onChange={(e) =>
                        setPublicationYear(
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Language
                    </label>
                    <select
                      aria-label="Language"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-medium text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                    >
                      <option value="English">English</option>
                      <option value="Hindi">Hindi</option>
                      <option value="Sanskrit">Sanskrit</option>
                      <option value="German">German</option>
                      <option value="French">French</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[#0F172A]">
                      Page Count
                    </label>
                    <Input
                      type="number"
                      placeholder="e.g. 464"
                      value={pageCount}
                      onChange={(e) =>
                        setPageCount(
                          e.target.value ? Number(e.target.value) : ""
                        )
                      }
                      className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-medium text-[#0F172A] focus:bg-white"
                    />
                  </div>
                </div>

                {/* Abstract / Summary Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#0F172A]">
                    Abstract / Summary Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="A practical guide to writing clean, maintainable, and professional software, with principles, practices, and real-world examples."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 py-2.5 text-xs font-medium text-[#0F172A] placeholder:text-slate-400 focus:border-[#2563EB] focus:bg-white focus:outline-none"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Physical Inventory & Copies */}
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-[#F0FDF4] text-[#16A34A]">
                      <Layers className="size-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-extrabold text-[#0F172A]">
                        Physical Inventory & Copies
                      </CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        Accessioning numbers, shelf placement, and condition assignment
                      </CardDescription>
                    </div>
                  </div>

                  {/* Mode Selector Toggle matching reference image */}
                  <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setCopiesMode("quick")}
                      className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                        copiesMode === "quick"
                          ? "bg-[#DBEAFE] text-[#1D4ED8] shadow-2xs"
                          : "text-slate-600 hover:text-[#0F172A]"
                      }`}
                    >
                      Quick Multi-Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => setCopiesMode("custom")}
                      className={`rounded-lg px-3 py-1.5 font-bold transition-colors ${
                        copiesMode === "custom"
                          ? "bg-[#DBEAFE] text-[#1D4ED8] shadow-2xs"
                          : "text-slate-600 hover:text-[#0F172A]"
                      }`}
                    >
                      Custom Accession
                    </button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {copiesMode === "quick" ? (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#0F172A]">
                          Number of Copies to Provision
                        </label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={copiesCount}
                          onChange={(e) =>
                            setCopiesCount(Math.max(1, Number(e.target.value)))
                          }
                          className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#0F172A]">
                          Default Shelf Location
                        </label>
                        <Input
                          placeholder="MAIN-STACKS"
                          value={shelfLocation}
                          onChange={(e) => setShelfLocation(e.target.value)}
                          list="shelf-locations-datalist"
                          className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white"
                        />
                        <datalist id="shelf-locations-datalist">
                          <option value="MAIN-STACKS" />
                          <option value="STACK-A-01" />
                          <option value="STACK-B-02" />
                          <option value="REFERENCE-BAY" />
                        </datalist>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#0F172A]">
                          Item Condition
                        </label>
                        <select
                          aria-label="Item Condition"
                          value={copyCondition}
                          onChange={(e) =>
                            setCopyCondition(e.target.value as ItemCondition)
                          }
                          className="h-9 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 text-xs font-semibold text-[#0F172A] focus:border-[#2563EB] focus:bg-white focus:outline-none"
                        >
                          <option value="GOOD">GOOD — Nominal Condition</option>
                          <option value="NEW">NEW — Brand New</option>
                          <option value="FAIR">FAIR — Minor Wear</option>
                          <option value="WORN">WORN — Heavy Use</option>
                          <option value="DAMAGED">
                            DAMAGED — Needs Binding
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="grid items-end gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#0F172A]">
                          Acquisition Cost (₹)
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="799.00"
                          value={price}
                          onChange={(e) =>
                            setPrice(
                              e.target.value ? Number(e.target.value) : ""
                            )
                          }
                          className="h-9 rounded-xl border-slate-200 bg-[#F8FAFC] text-xs font-semibold text-[#0F172A] focus:bg-white"
                        />
                      </div>

                      <div className="flex items-center gap-2.5 pb-2 sm:col-span-2">
                        <input
                          type="checkbox"
                          id="ref-only-check"
                          checked={isReferenceOnly}
                          onChange={(e) => setIsReferenceOnly(e.target.checked)}
                          className="size-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]"
                        />
                        <label
                          htmlFor="ref-only-check"
                          className="cursor-pointer text-xs font-medium text-slate-700"
                        >
                          Mark copies as{" "}
                          <span className="font-bold text-[#D97706]">
                            Reference Only
                          </span>{" "}
                          (Restricts circulation checkouts)
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500">
                        Explicit accession numbers and barcodes for barcode label scanning
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleAddCustomCopy}
                        className="h-7 text-xs font-bold text-[#2563EB]"
                      >
                        <Plus className="mr-1 size-3" />
                        Add Copy
                      </Button>
                    </div>

                    {validationErrors.customCopies && (
                      <p className="text-[11px] font-medium text-[#DC2626]">
                        {validationErrors.customCopies}
                      </p>
                    )}

                    <div className="space-y-2">
                      {customCopies.map((copy, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-2.5"
                        >
                          <div className="col-span-4 space-y-1">
                            <span className="font-mono text-[10px] text-slate-500">
                              Accession No.
                            </span>
                            <Input
                              placeholder="e.g. ACC-2026-00045"
                              value={copy.accessionNumber}
                              onChange={(e) => {
                                const updated = [...customCopies];
                                updated[index]!.accessionNumber =
                                  e.target.value;
                                setCustomCopies(updated);
                              }}
                              className="h-8 font-mono text-xs"
                            />
                          </div>

                          <div className="col-span-3 space-y-1">
                            <span className="font-mono text-[10px] text-slate-500">
                              Barcode
                            </span>
                            <Input
                              placeholder="e.g. BC-00045"
                              value={copy.barcode}
                              onChange={(e) => {
                                const updated = [...customCopies];
                                updated[index]!.barcode = e.target.value;
                                setCustomCopies(updated);
                              }}
                              className="h-8 font-mono text-xs"
                            />
                          </div>

                          <div className="col-span-4 space-y-1">
                            <span className="font-mono text-[10px] text-slate-500">
                              Shelf Location
                            </span>
                            <Input
                              placeholder="MAIN-STACKS"
                              value={copy.shelfLocation}
                              onChange={(e) => {
                                const updated = [...customCopies];
                                updated[index]!.shelfLocation = e.target.value;
                                setCustomCopies(updated);
                              }}
                              className="h-8 text-xs"
                            />
                          </div>

                          <div className="col-span-1 flex justify-end pt-4">
                            {customCopies.length > 1 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveCustomCopy(index)}
                                className="size-8 text-slate-400 hover:text-[#DC2626]"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons inside Physical Inventory & Copies Card matching reference image */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="h-10 rounded-xl bg-[#2563EB] px-6 text-xs font-bold text-white shadow-sm hover:bg-[#1D4ED8]"
                  >
                    {createMutation.isPending ? (
                      <>
                        <RefreshCw className="mr-1.5 size-4 animate-spin" />
                        Committing to Neon DB...
                      </>
                    ) : (
                      <>
                        <Save className="mr-1.5 size-4" />
                        Commit Bibliographic Record & Provision Copies
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReset}
                    disabled={createMutation.isPending}
                    className="h-10 rounded-xl border-slate-200 bg-white px-5 text-xs font-bold text-[#0F172A] hover:bg-slate-50"
                  >
                    Reset Form
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (4 cols): Cataloguing Standards & Accession Preview */}
          <div className="space-y-5 lg:col-span-4">
            {/* Card 1: Cataloguing Standards */}
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                    <Sparkles className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-extrabold text-[#0F172A]">
                      Cataloguing Standards
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Institutional library compliance
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs text-slate-600">
                <div className="space-y-1.5 rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-3.5">
                  <span className="flex items-center gap-2 font-bold text-[#0F172A]">
                    <Barcode className="size-4 text-[#2563EB]" />
                    Accession Number Format
                  </span>
                  <p className="leading-relaxed">
                    Consecutive institutional identifier formatted as{" "}
                    <code className="font-mono font-bold text-[#2563EB]">
                      ACC-YYYY-XXXXX
                    </code>
                    . Generated automatically inside the Neon PostgreSQL transaction.
                  </p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-3.5">
                  <span className="flex items-center gap-2 font-bold text-[#0F172A]">
                    <Tag className="size-4 text-[#16A34A]" />
                    RFID Transponder Queue
                  </span>
                  <p className="leading-relaxed">
                    Newly accessioned physical copies immediately propagate to the{" "}
                    <Link
                      to="/rfid-tagging"
                      className="font-bold text-[#2563EB] underline"
                    >
                      RFID Tagging Station
                    </Link>{" "}
                    queue for ISO 15693 / UHF EPC Gen2 tag encoding and EAS arming.
                  </p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-slate-200/90 bg-[#F8FAFC] p-3.5">
                  <span className="flex items-center gap-2 font-bold text-[#0F172A]">
                    <AlertCircle className="size-4 text-[#F59E0B]" />
                    ISBN Uniqueness Policy
                  </span>
                  <p className="leading-relaxed">
                    Duplicate ISBN-13 entries are rejected at the database level to maintain bibliographic integrity across integrated institutional catalogs.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Accession Preview matching reference image */}
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base font-extrabold text-[#0F172A]">
                  <FileText className="size-4 text-[#2563EB]" />
                  Accession Preview
                </CardTitle>
              </CardHeader>

              <CardContent className="space-y-1 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 py-2.5">
                  <span className="font-medium text-slate-600">
                    Target Year
                  </span>
                  <span className="font-extrabold text-[#0F172A]">
                    {new Date().getFullYear()}
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 py-2.5">
                  <span className="font-medium text-slate-600">
                    Copies to Create
                  </span>
                  <span className="font-extrabold text-[#0F172A]">
                    {copiesMode === "quick" ? copiesCount : customCopies.length}{" "}
                    copy(s)
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 py-2.5">
                  <span className="font-medium text-slate-600">
                    Circulation Status
                  </span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold ${
                      isReferenceOnly
                        ? "bg-amber-100 text-amber-800"
                        : "bg-[#DCFCE7] text-[#15803D]"
                    }`}
                  >
                    {isReferenceOnly ? "Reference Only" : "Circulating"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2.5">
                  <span className="font-medium text-slate-600">
                    Assigned Shelf
                  </span>
                  <span className="font-mono font-extrabold text-[#0F172A]">
                    {shelfLocation || "MAIN-STACKS"}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
