import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, BookOpen, Tag } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ItemStatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/error-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { apiGet } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import type { ApiResponse, Book } from "@/types";

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["books", id],
    queryFn: () => apiGet<ApiResponse<Book>>(`/books/${id}`),
    enabled: !!id,
  });

  const book = data?.data;

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

  if (isError || !book) {
    return <ErrorState onRetry={() => refetch()} title="Book not found" />;
  }

  return (
    <div>
      <PageHeader
        title={book.title}
        description={`by ${book.author}`}
        breadcrumbs={[
          { label: "Dashboard", to: "/" },
          { label: "Book Catalog", to: "/books" },
          { label: book.title },
        ]}
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/books">
              <ArrowLeft className="size-4" />
              Back to Catalog
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        {/* Bibliographic info */}
        <Card>
          <CardHeader>
            <CardTitle>Bibliographic Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="flex flex-col gap-3 text-sm">
              {[
                { label: "ISBN", value: book.isbn },
                { label: "Publisher", value: book.publisher },
                { label: "Published Year", value: book.publishedYear },
                { label: "Edition", value: book.edition },
                { label: "Language", value: book.language },
                { label: "Pages", value: book.pages },
                { label: "Category", value: book.category?.name },
                { label: "Added", value: formatDate(book.createdAt) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground shrink-0">{label}</dt>
                  <dd className="font-medium text-right">
                    {value ?? <span className="text-muted-foreground">—</span>}
                  </dd>
                </div>
              ))}
              {book.tags && book.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {book.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            {book.description ? (
              <p className="text-sm leading-relaxed text-muted-foreground">{book.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No description available.</p>
            )}
          </CardContent>
        </Card>

        {/* Copies */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="size-4" />
              Physical Copies
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {book.copies?.length ?? 0} copies
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!book.copies || book.copies.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No copies catalogued yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Accession No.</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>RFID Tag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {book.copies.map((copy) => (
                    <TableRow key={copy.id}>
                      <TableCell className="identifier">{copy.accessionNumber}</TableCell>
                      <TableCell><ItemStatusBadge status={copy.status} /></TableCell>
                      <TableCell className="text-muted-foreground">{copy.condition}</TableCell>
                      <TableCell className="text-muted-foreground">{copy.location ?? "—"}</TableCell>
                      <TableCell>
                        {copy.rfidTag ? (
                          <div className="flex items-center gap-1">
                            <Tag className="size-3 text-rfid" />
                            <span className="identifier text-xs">{copy.rfidTag.epc}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Untagged</span>
                        )}
                      </TableCell>
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

