import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  FileUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  FileSpreadsheet,
  RefreshCw,
  Play,
  RotateCcw,
  Download,
  Eye,
  Loader2,
  Layers,
  ArrowRight,
  ShieldAlert,
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
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { apiGet, apiPost, apiUpload } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type {
  PaginatedResponse,
  MigrationBatch,
  MigrationBatchStatus,
  MigrationUploadResponse,
  MigrationPreviewResponse,
} from "@/types";

function BatchStatusBadge({ status }: { status: MigrationBatchStatus }) {
  const map: Record<MigrationBatchStatus, { label: string; className: string }> = {
    UPLOADED: { label: "Uploaded", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
    VALIDATING: { label: "Validating", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    VALIDATED: { label: "Validated", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
    DRY_RUN_COMPLETED: { label: "Dry Run Ready", className: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
    COMMITTED: { label: "Committed", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    ROLLED_BACK: { label: "Rolled Back", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400" },
    FAILED: { label: "Failed", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  };
  const cfg = map[status] ?? { label: status, className: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export default function DataMigrationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";

  // Tab: "upload" | "workspace" | "history"
  const [activeTab, setActiveTab] = useState<"upload" | "workspace" | "history">("upload");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchName, setBatchName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workspace sub-tabs
  const [workspaceTab, setWorkspaceTab] = useState<"dryrun" | "preview" | "errors">("dryrun");

  // Dialogs
  const [showCommitDialog, setShowCommitDialog] = useState(false);
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [rollbackBatchId, setRollbackBatchId] = useState<string | null>(null);

  // Notification Banner
  const [banner, setBanner] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showBanner = useCallback((type: "success" | "error", message: string) => {
    setBanner({ type, message });
    if (type === "success") setTimeout(() => setBanner(null), 8000);
  }, []);

  // ─── Queries ────────────────────────────────────────────────────────────────

  // List of all migration batches
  const batchesQuery = useQuery({
    queryKey: ["migrations", "batches"],
    queryFn: () => apiGet<PaginatedResponse<MigrationBatch>>("/migrations", { limit: 20 }),
    staleTime: 10_000,
  });

  // Active batch detail
  const batchDetailQuery = useQuery({
    queryKey: ["migrations", "batch", activeBatchId],
    queryFn: () => apiGet<{ success: boolean; data: MigrationBatch }>(`/migrations/${activeBatchId}`),
    enabled: !!activeBatchId,
    refetchInterval: (query) => {
      const status = query.state.data?.data?.status;
      return status === "VALIDATING" ? 2000 : false;
    },
  });

  // Preview records query
  const previewQuery = useQuery({
    queryKey: ["migrations", "preview", activeBatchId, workspaceTab],
    queryFn: () =>
      apiGet<{ success: boolean; data: MigrationPreviewResponse }>(
        `/migrations/${activeBatchId}/preview`,
        {
          limit: 50,
          status: workspaceTab === "errors" ? "INVALID" : workspaceTab === "preview" ? "VALID" : "ALL",
        }
      ),
    enabled: !!activeBatchId && (workspaceTab === "preview" || workspaceTab === "errors"),
  });

  // ─── Mutations ───────────────────────────────────────────────────────────────

  // Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) =>
      apiUpload<{ success: boolean; data: MigrationUploadResponse }>("/migrations/upload", formData),
    onSuccess: (res) => {
      const newBatch = res.data.batch;
      setActiveBatchId(newBatch.id);
      setSelectedFile(null);
      setBatchName("");
      setActiveTab("workspace");
      setWorkspaceTab("dryrun");
      showBanner("success", `✓ File successfully uploaded and staged (${res.data.totalStaged} records staged).`);
      queryClient.invalidateQueries({ queryKey: ["migrations", "batches"] });
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Failed to upload file.";
      showBanner("error", msg);
    },
  });

  // Validate Mutation
  const validateMutation = useMutation({
    mutationFn: (batchId: string) => apiPost(`/migrations/${batchId}/validate`),
    onSuccess: () => {
      showBanner("success", "✓ Validation complete. Check records and dry-run preview below.");
      queryClient.invalidateQueries({ queryKey: ["migrations", "batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["migrations", "preview", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["migrations", "batches"] });
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Validation failed.";
      showBanner("error", msg);
    },
  });

  // Dry-Run Mutation
  const dryRunMutation = useMutation({
    mutationFn: (batchId: string) => apiPost(`/migrations/${batchId}/dry-run`),
    onSuccess: () => {
      showBanner("success", "✓ Dry run simulation completed successfully.");
      queryClient.invalidateQueries({ queryKey: ["migrations", "batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["migrations", "batches"] });
    },
    onError: (err: unknown) => {
      const msg = extractErrorMessage(err) ?? "Dry run simulation failed.";
      showBanner("error", msg);
    },
  });

  // Commit Mutation
  const commitMutation = useMutation({
    mutationFn: (batchId: string) => apiPost(`/migrations/${batchId}/commit`),
    onSuccess: (data: unknown) => {
      setShowCommitDialog(false);
      const res = data as { data?: { reconciliation?: { committedBooksCount?: number } } };
      const count = res?.data?.reconciliation?.committedBooksCount ?? "all";
      showBanner("success", `✓ Batch committed into institutional catalog! (${count} books created with accession numbers).`);
      queryClient.invalidateQueries({ queryKey: ["migrations", "batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["migrations", "batches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (err: unknown) => {
      setShowCommitDialog(false);
      const msg = extractErrorMessage(err) ?? "Commit failed.";
      showBanner("error", msg);
    },
  });

  // Rollback Mutation
  const rollbackMutation = useMutation({
    mutationFn: (batchId: string) => apiPost(`/migrations/${batchId}/rollback`),
    onSuccess: (data: unknown) => {
      setShowRollbackDialog(false);
      setRollbackBatchId(null);
      const res = data as { data?: { deletedBooksCount?: number } };
      showBanner("success", `✓ Rollback complete. Safely removed ${res?.data?.deletedBooksCount ?? 0} books.`);
      queryClient.invalidateQueries({ queryKey: ["migrations", "batch", activeBatchId] });
      queryClient.invalidateQueries({ queryKey: ["migrations", "batches"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      queryClient.invalidateQueries({ queryKey: ["books"] });
    },
    onError: (err: unknown) => {
      setShowRollbackDialog(false);
      const msg = extractErrorMessage(err) ?? "Rollback failed. Check if any copies are currently on loan.";
      showBanner("error", msg);
    },
  });

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (batchName.trim()) {
      formData.append("batchName", batchName.trim());
    }

    uploadMutation.mutate(formData);
  };

  const activeBatch = batchDetailQuery.data?.data;
  const batches = batchesQuery.data?.data ?? [];
  const previewData = previewQuery.data?.data;

  return (
    <div>
      <PageHeader
        title="Data Migration & ILS Ingestion"
        description="Enterprise batch ingestion, automated validation, dry-run reconciliation, and safe rollback"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Data Migration" }]}
      />

      {/* Alert Banner */}
      {banner && (
        <div
          className={`flex items-start gap-2 rounded-md p-3.5 text-sm mb-6 ${
            banner.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800"
              : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          )}
          <span className="flex-1 font-medium">{banner.message}</span>
          <button onClick={() => setBanner(null)} className="ml-2 text-current opacity-70 hover:opacity-100 font-bold">
            ×
          </button>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex gap-2 border-b mb-6">
        <button
          onClick={() => setActiveTab("upload")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "upload"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="size-4" />
          New Ingestion
        </button>
        <button
          onClick={() => setActiveTab("workspace")}
          disabled={!activeBatchId}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "workspace"
              ? "border-primary text-primary"
              : !activeBatchId
              ? "opacity-50 cursor-not-allowed border-transparent text-muted-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="size-4" />
          Batch Workspace {activeBatch ? `(${activeBatch.batchName})` : ""}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "history"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Database className="size-4" />
          Migration History ({batches.length})
        </button>
      </div>

      {/* ── TAB 1: UPLOAD & INGESTION ── */}
      {activeTab === "upload" && (
        <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>Upload Legacy Library Records</span>
                <Badge variant="outline" className="text-xs">CSV / XLSX / JSON</Badge>
              </CardTitle>
              <CardDescription>
                Stage raw records into an isolated migration batch without writing to live catalog tables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUploadSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-foreground">Custom Batch Name (Optional)</label>
                  <Input
                    placeholder="e.g. Koha-Main-Collection-2026"
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    disabled={uploadMutation.isPending}
                  />
                </div>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center flex flex-col items-center justify-center gap-2.5 transition-colors ${
                    isDragging
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 bg-muted/5 hover:bg-muted/15"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.json"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setSelectedFile(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="rounded-full bg-primary/10 p-3 text-primary">
                    <FileSpreadsheet className="size-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {selectedFile ? selectedFile.name : "Click to select or drag and drop dataset file"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedFile
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB — Ready to stage`
                        : "Supports CSV (.csv), Excel (.xlsx), and JSON exports up to 50MB"}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant="outline" className="mt-1 pointer-events-none">
                    <FileUp className="size-3.5 mr-1" />
                    Browse Files
                  </Button>
                </div>

                <Button
                  type="submit"
                  disabled={!selectedFile || uploadMutation.isPending}
                  className="w-full sm:w-auto self-start mt-2"
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-1.5" />
                      Parsing & Staging Records...
                    </>
                  ) : (
                    <>
                      <Upload className="size-4 mr-1.5" />
                      Upload & Stage Records
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Safety Policy Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pre-flight Safety Pipeline</CardTitle>
              <CardDescription>Four-stage zero-downtime architecture</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3.5 text-xs text-muted-foreground">
              <div className="flex items-start gap-2.5 rounded-lg border p-3">
                <CheckCircle2 className="size-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">1. Isolated Staging</p>
                  <p>Raw records are parsed, sanitized against formula injection, and buffered in staging tables.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border p-3">
                <CheckCircle2 className="size-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">2. Deep Collision Check</p>
                  <p>Validates ISBN checksums, accession numbers, and author names against existing catalog.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border p-3">
                <CheckCircle2 className="size-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">3. Non-Destructive Dry Run</p>
                  <p>Generates source-to-destination reconciliation counts without altering any production tables.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-lg border p-3">
                <CheckCircle2 className="size-4 text-green-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-foreground">4. Guaranteed Rollback</p>
                  <p>Atomic single-click rollback automatically reverts catalog entries if unexpected errors occur.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TAB 2: ACTIVE BATCH WORKSPACE ── */}
      {activeTab === "workspace" && activeBatch && (
        <div className="flex flex-col gap-6">
          {/* Batch Status Header Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">{activeBatch.batchName}</CardTitle>
                    <BatchStatusBadge status={activeBatch.status} />
                  </div>
                  <CardDescription className="mt-1">
                    Source: <span className="font-mono text-xs text-foreground">{activeBatch.sourceFileName}</span> • Staged on {formatDateTime(activeBatch.createdAt)}
                  </CardDescription>
                </div>

                {/* Pipeline Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Validate button */}
                  {activeBatch.status === "UPLOADED" && (
                    <Button
                      size="sm"
                      onClick={() => validateMutation.mutate(activeBatch.id)}
                      disabled={validateMutation.isPending}
                    >
                      {validateMutation.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Play className="size-3.5 mr-1" />}
                      Run Validation
                    </Button>
                  )}

                  {/* Dry Run button */}
                  {(activeBatch.status === "VALIDATED" || activeBatch.status === "UPLOADED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => dryRunMutation.mutate(activeBatch.id)}
                      disabled={dryRunMutation.isPending}
                    >
                      {dryRunMutation.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <RefreshCw className="size-3.5 mr-1" />}
                      Execute Dry Run
                    </Button>
                  )}

                  {/* Commit button */}
                  {(activeBatch.status === "VALIDATED" || activeBatch.status === "DRY_RUN_COMPLETED") && isAdmin && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => setShowCommitDialog(true)}
                      disabled={commitMutation.isPending || activeBatch.validRecords === 0}
                    >
                      <CheckCircle2 className="size-3.5 mr-1" />
                      Commit to Catalog
                    </Button>
                  )}

                  {/* Rollback button */}
                  {activeBatch.status === "COMMITTED" && isAdmin && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setRollbackBatchId(activeBatch.id); setShowRollbackDialog(true); }}
                    >
                      <RotateCcw className="size-3.5 mr-1" />
                      Rollback Batch
                    </Button>
                  )}

                  {/* Export errors */}
                  {activeBatch.errorRecords > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        window.open(`/api/v1/migrations/${activeBatch.id}/errors/export`, "_blank");
                      }}
                    >
                      <Download className="size-3.5 mr-1" />
                      Export Errors (CSV)
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stat Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total Records</p>
                  <p className="text-xl font-bold mt-0.5">{activeBatch.totalRecords.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Valid Records</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400 mt-0.5">
                    {activeBatch.validRecords.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Invalid / Duplicates</p>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400 mt-0.5">
                    {activeBatch.errorRecords.toLocaleString()}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Committed Books</p>
                  <p className="text-xl font-bold text-primary mt-0.5">
                    {activeBatch.migratedRecords.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Workspace Sub-tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setWorkspaceTab("dryrun")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                workspaceTab === "dryrun"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Reconciliation & Dry Run
            </button>
            <button
              onClick={() => setWorkspaceTab("preview")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                workspaceTab === "preview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Valid Records Sample ({activeBatch.validRecords})
            </button>
            <button
              onClick={() => setWorkspaceTab("errors")}
              className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                workspaceTab === "errors"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              Validation Error Log ({activeBatch.errorRecords})
            </button>
          </div>

          {/* ── SUB-TAB: DRY RUN & RECONCILIATION ── */}
          {workspaceTab === "dryrun" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Catalog Impact & Entity Estimation</CardTitle>
                <CardDescription>
                  Projected database mutations verified prior to transactional commitment
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activeBatch.dryRunSummary ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="rounded-lg border p-3.5">
                      <p className="text-xs text-muted-foreground">New Bibliographic Records</p>
                      <p className="text-2xl font-bold mt-1 text-primary">
                        +{activeBatch.dryRunSummary.estimatedNewBooks ?? activeBatch.validRecords}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Unique title records to be catalogued</p>
                    </div>
                    <div className="rounded-lg border p-3.5">
                      <p className="text-xs text-muted-foreground">New Physical Book Copies</p>
                      <p className="text-2xl font-bold mt-1 text-primary">
                        +{activeBatch.dryRunSummary.estimatedNewCopies ?? activeBatch.validRecords}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Accession numbers automatically sequenced</p>
                    </div>
                    <div className="rounded-lg border p-3.5">
                      <p className="text-xs text-muted-foreground">Publishers to Upsert</p>
                      <p className="text-2xl font-bold mt-1 text-foreground">
                        {activeBatch.dryRunSummary.estimatedPublishers ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Automatically deduplicated by name</p>
                    </div>
                    <div className="rounded-lg border p-3.5">
                      <p className="text-xs text-muted-foreground">Categories to Upsert</p>
                      <p className="text-2xl font-bold mt-1 text-foreground">
                        {activeBatch.dryRunSummary.estimatedCategories ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Hierarchical Dewey/LC subjects</p>
                    </div>
                    <div className="rounded-lg border p-3.5">
                      <p className="text-xs text-muted-foreground">Authors to Upsert</p>
                      <p className="text-2xl font-bold mt-1 text-foreground">
                        {activeBatch.dryRunSummary.estimatedAuthors ?? "—"}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Individual author and editor profiles</p>
                    </div>
                    <div className="rounded-lg border p-3.5">
                      <p className="text-xs text-muted-foreground">Batch Success Rate</p>
                      <p className="text-2xl font-bold mt-1 text-green-600 dark:text-green-400">
                        {activeBatch.dryRunSummary.reconciliation?.successRatePercentage ??
                          (activeBatch.totalRecords > 0
                            ? Math.round((activeBatch.validRecords / activeBatch.totalRecords) * 100)
                            : 0)}
                        %
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">Ratio of valid to total source records</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <p>Run Validation or Execute Dry Run to preview entity projections.</p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => dryRunMutation.mutate(activeBatch.id)}
                      disabled={dryRunMutation.isPending}
                    >
                      {dryRunMutation.isPending ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Play className="size-3.5 mr-1" />}
                      Execute Dry Run Now
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── SUB-TAB: VALID RECORDS PREVIEW ── */}
          {workspaceTab === "preview" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sample Validated Records</CardTitle>
                <CardDescription>Records ready for atomic commit into library catalog</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {previewQuery.isLoading ? (
                  <div className="p-4 flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : !previewData?.records?.length ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No validated records found. Please trigger validation first.
                  </div>
                ) : (
                  <div className="w-full max-w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12 whitespace-nowrap pl-4">#</TableHead>
                          <TableHead className="whitespace-nowrap">Title</TableHead>
                          <TableHead className="whitespace-nowrap">ISBN-13</TableHead>
                          <TableHead className="whitespace-nowrap">Authors</TableHead>
                          <TableHead className="whitespace-nowrap">Publisher</TableHead>
                          <TableHead className="whitespace-nowrap">Shelf</TableHead>
                          <TableHead className="whitespace-nowrap pr-4 text-right">Copies</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewData.records.map((rec) => (
                          <TableRow key={rec.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap pl-4">{rec.rowNumber}</TableCell>
                            <TableCell className="font-medium text-sm min-w-[180px]">{rec.normalized?.title ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{rec.normalized?.isbn13 ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground min-w-[140px]">
                              {rec.normalized?.authors?.join(", ") ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{rec.normalized?.publisher ?? "—"}</TableCell>
                            <TableCell className="text-xs font-mono whitespace-nowrap">{rec.normalized?.shelfLocation ?? "MAIN-STACKS"}</TableCell>
                            <TableCell className="text-right font-medium text-xs whitespace-nowrap pr-4">{rec.normalized?.copiesCount ?? 1}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── SUB-TAB: VALIDATION ERROR LOG ── */}
          {workspaceTab === "errors" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle className="size-4" />
                    Validation Errors & Rejections ({activeBatch.errorRecords})
                  </CardTitle>
                  <CardDescription>Row-level breakdown of rejected records that will be skipped during commit</CardDescription>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.open(`/api/v1/migrations/${activeBatch.id}/errors/export`, "_blank");
                  }}
                >
                  <Download className="size-3.5 mr-1" />
                  Download CSV Error Report
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {previewQuery.isLoading ? (
                  <div className="p-4 flex flex-col gap-2">
                    {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
                  </div>
                ) : !previewData?.records?.length ? (
                  <div className="p-6 text-center text-sm text-green-600 dark:text-green-400 font-medium">
                    ✓ Clean batch! Zero validation errors detected.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row #</TableHead>
                        <TableHead>Provided Title</TableHead>
                        <TableHead>Detected Error Reasons</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewData.records.map((rec) => {
                        const rawTitle = String(rec.raw['title'] || rec.raw['book_title'] || "—");
                        return (
                          <TableRow key={rec.id} className="bg-red-50/20 dark:bg-red-950/10">
                            <TableCell className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                              {rec.rowNumber}
                            </TableCell>
                            <TableCell className="text-sm font-medium">{rawTitle}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {Array.isArray(rec.errors) ? (
                                  rec.errors.map((err, idx) => (
                                    <span key={idx} className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                                      • {err}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-red-600 dark:text-red-400">• Validation failed</span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── TAB 3: MIGRATION HISTORY ── */}
      {activeTab === "history" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Institutional Migration Batches</CardTitle>
              <CardDescription>Audit history of catalog ingestions and rollback operations</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => batchesQuery.refetch()}>
              <RefreshCw className="size-3.5 mr-1" />
              Refresh History
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {batchesQuery.isLoading ? (
              <div className="p-4 flex flex-col gap-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : batches.length === 0 ? (
              <EmptyState
                icon={Database}
                title="No migrations found"
                message="No legacy catalog datasets have been ingested yet."
              />
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap pl-5">Batch Name</TableHead>
                      <TableHead className="whitespace-nowrap">Source File</TableHead>
                      <TableHead className="whitespace-nowrap">Total Records</TableHead>
                      <TableHead className="whitespace-nowrap">Valid / Errors</TableHead>
                      <TableHead className="whitespace-nowrap">Committed</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Operator</TableHead>
                      <TableHead className="whitespace-nowrap pr-5 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batches.map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="font-medium text-sm whitespace-nowrap pl-5">
                          <button
                            onClick={() => {
                              setActiveBatchId(batch.id);
                              setActiveTab("workspace");
                            }}
                            className="hover:underline text-primary font-semibold text-left"
                          >
                            {batch.batchName}
                          </button>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground truncate max-w-[150px] whitespace-nowrap">
                          {batch.sourceFileName}
                        </TableCell>
                        <TableCell className="text-xs font-semibold whitespace-nowrap">{batch.totalRecords.toLocaleString()}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {batch.validRecords.toLocaleString()}
                          </span>
                          {" / "}
                          <span className="text-red-600 dark:text-red-400 font-medium">
                            {batch.errorRecords.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-bold text-primary whitespace-nowrap">
                          {batch.migratedRecords.toLocaleString()}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <BatchStatusBadge status={batch.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {batch.executedByUser
                            ? `${batch.executedByUser.firstName} ${batch.executedByUser.lastName}`
                            : "Administrator"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-5 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setActiveBatchId(batch.id);
                                setActiveTab("workspace");
                              }}
                            >
                              <Eye className="size-3 mr-1" />
                              Inspect
                            </Button>
                            {batch.status === "COMMITTED" && isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setRollbackBatchId(batch.id);
                                  setShowRollbackDialog(true);
                                }}
                              >
                                <RotateCcw className="size-3 mr-1" />
                                Rollback
                              </Button>
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

      {/* ── COMMIT CONFIRMATION MODAL ── */}
      <Dialog open={showCommitDialog} onOpenChange={(open: boolean) => { if (!open) setShowCommitDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-green-600" />
              Confirm Production Catalog Commit
            </DialogTitle>
            <DialogDescription>
              This operation will permanently commit validated records into live bibliographic and physical copy tables.
            </DialogDescription>
          </DialogHeader>
          {activeBatch && (
            <div className="space-y-3 py-2 text-sm">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Batch Name:</span>
                <span className="font-semibold">{activeBatch.batchName}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Records to Commit:</span>
                <span className="font-bold text-green-600">{activeBatch.validRecords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Invalid / Skipped Records:</span>
                <span className="font-bold text-red-600">{activeBatch.errorRecords.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                All created copies will be assigned official institutional accession numbers and will be ready for RFID tag encoding.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCommitDialog(false)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                if (activeBatchId) commitMutation.mutate(activeBatchId);
              }}
              disabled={commitMutation.isPending}
            >
              {commitMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <CheckCircle2 className="size-4 mr-1" />}
              Confirm & Execute Commit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── ROLLBACK CONFIRMATION MODAL ── */}
      <Dialog open={showRollbackDialog} onOpenChange={(open: boolean) => { if (!open) setShowRollbackDialog(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="size-5" />
              Authorize Catalog Rollback
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to revert this migration batch?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-xs text-muted-foreground">
              This will safely remove books and physical copies created by this batch. If any copy has been checked out or has dependent circulation history, rollback will be safely aborted.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRollbackDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rollbackBatchId) rollbackMutation.mutate(rollbackBatchId);
              }}
              disabled={rollbackMutation.isPending}
            >
              {rollbackMutation.isPending ? <Loader2 className="size-4 animate-spin mr-1" /> : <RotateCcw className="size-4 mr-1" />}
              Authorize & Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
