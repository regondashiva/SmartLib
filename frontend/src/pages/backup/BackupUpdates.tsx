import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HardDrive,
  Download,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Database,
  AlertTriangle,
  RotateCcw,
  PackageCheck,
  History,
  Activity,
  Radio,
  Play,
  Loader2,
  FileCheck2,
  Server,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
import { apiGet, apiPost } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import type { ApiResponse } from "@/types";

interface SystemVersionStatus {
  currentVersion: string;
  lastKnownGoodVersion: string;
  lastKnownGoodBackupId: string | null;
  updateState: string;
  isOperationInProgress: boolean;
  currentOperationSteps: Array<{
    step: number;
    name: string;
    state: string;
    status: "PASSED" | "FAILED" | "SKIPPED";
    timestamp: string;
    details: string;
  }>;
  lastError: string | null;
  manifest: {
    packageId: string;
    appVersion: string;
    minSupportedUpgradeVersion: string;
    buildTimestamp: string;
    components: {
      frontendVersion: string;
      backendVersion: string;
      rfidMiddlewareVersion: string;
      databaseSchemaVersion: string;
    };
    requiredRuntimes: {
      nodeMinVersion: string;
      pythonMinVersion: string;
      postgresqlMinVersion: string;
      supportedOs: string[];
    };
    migrations: {
      requiresSchemaMigration: boolean;
      backwardCompatible: boolean;
      destructiveChanges: boolean;
      migrationFiles: string[];
    };
    checksums: Record<
      string,
      { archiveName: string; sha256: string; sizeBytes: number }
    >;
    releaseNotes: string[];
  };
  rollbackEligibility: {
    eligible: boolean;
    targetVersion: string;
    lastKnownGoodBackupId: string | null;
    reason: string;
  };
  backups: Array<{
    backupId: string;
    label: string;
    createdAt: string;
    appVersion: string;
    schemaVersion: string;
    status: "VERIFIED" | "CORRUPTED" | "RESTORE_TESTED";
    isKnownGood: boolean;
    sizeBytes: number;
    sha256: string;
    tableCounts: Record<string, number>;
    restoreVerifiedAt: string | null;
    createdByEmail: string;
  }>;
  diagnostics: {
    status: "HEALTHY" | "DEGRADED";
    timestamp: string;
    checks: Array<{
      id: string;
      name: string;
      status: "PASS" | "FAIL";
      details: string;
    }>;
    rfidOfflineBuffer: {
      available: boolean;
      persistenceEngine: string;
      pendingEvents: number;
      syncedEvents: number;
      failedEvents: number;
      idempotencyConstraint: string;
      orderingGuarantee: string;
      survivesUpdateAndRestart: boolean;
    };
    deploymentCapabilities: {
      offlinePackageInstallation: boolean;
      rfidOfflineEventBuffering: boolean;
      fullApplicationOfflineDatabaseMode: boolean;
      databaseArchitectureNote: string;
    };
  };
}

interface SystemHistoryRecord {
  id: string;
  timestamp: string;
  entityName: string;
  entityId: string;
  operation: string;
  state: string;
  previousVersion: string | null;
  newVersion: string | null;
  backupId: string | null;
  reason: string;
  error: string | null;
  operator: {
    name: string;
    email: string;
  };
}

const SAMPLE_TARGET_MANIFEST = {
  packageId: "smartlib-offline-release-1.5.0",
  appVersion: "1.5.0",
  minSupportedUpgradeVersion: "1.0.0",
  buildTimestamp: "2026-11-09T14:00:00.000Z",
  components: {
    frontendVersion: "1.5.0",
    backendVersion: "1.5.0",
    rfidMiddlewareVersion: "1.3.0",
    databaseSchemaVersion: "2026.11.phase4f-v2",
  },
  requiredRuntimes: {
    nodeMinVersion: "20.0.0",
    pythonMinVersion: "3.11.0",
    postgresqlMinVersion: "15.0",
    supportedOs: ["Windows 11", "Windows Server 2022", "Linux x64"],
  },
  migrations: {
    requiresSchemaMigration: false,
    backwardCompatible: true,
    destructiveChanges: false,
    migrationFiles: ["0001_initial_schema.sql", "0002_phase4_indexes.sql"],
  },
  checksums: {
    frontendBundle: {
      archiveName: "smartlib-frontend-dist-1.5.0.tar.gz",
      sha256: "a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123",
      sizeBytes: 1325000,
    },
    backendBundle: {
      archiveName: "smartlib-backend-dist-1.5.0.tar.gz",
      sha256: "b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef012345",
      sizeBytes: 855000,
    },
    rfidMiddlewareBundle: {
      archiveName: "smartlib-rfid-service-1.3.0.tar.gz",
      sha256: "c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01234567",
      sizeBytes: 420000,
    },
    databaseSchemaBundle: {
      archiveName: "smartlib-prisma-schema-2026.11.tar.gz",
      sha256: "d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123456789",
      sizeBytes: 39500,
    },
  },
  releaseNotes: [
    "Enhanced offline package checksum verification and restore readiness validator",
    "RFID SQLite WAL queue continuity across service restarts and updates",
  ],
};

type LifecycleTab =
  | "OVERVIEW"
  | "UPDATE_MANAGER"
  | "BACKUPS"
  | "ROLLBACK_RECOVERY"
  | "HISTORY";

export default function BackupUpdatesPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<LifecycleTab>("OVERVIEW");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Backup form state
  const [backupLabel, setBackupLabel] = useState("Pre-Maintenance Snapshot");

  // Update package validation & execution state
  const [manifestJson, setManifestJson] = useState(() =>
    JSON.stringify(SAMPLE_TARGET_MANIFEST, null, 2)
  );
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [updateReason, setUpdateReason] = useState(
    "Apply verified offline release package v1.5.0"
  );
  const [confirmUpdateDialogOpen, setConfirmUpdateDialogOpen] = useState(false);

  // Rollback confirmation state
  const [confirmRollbackDialogOpen, setConfirmRollbackDialogOpen] = useState(false);
  const [rollbackReason, setRollbackReason] = useState(
    "Revert to last known-good version after post-update verification"
  );
  const [restoreDbOnRollback, setRestoreDbOnRollback] = useState(false);
  const [confirmDataLossAck, setConfirmDataLossAck] = useState(false);

  // 1. Fetch current version, manifest, backups, and diagnostics
  const {
    data: statusRes,
    isLoading,
    refetch: refetchStatus,
  } = useQuery<ApiResponse<SystemVersionStatus>>({
    queryKey: ["system", "version-status"],
    queryFn: () => apiGet<ApiResponse<SystemVersionStatus>>("/system/version"),
    staleTime: 10_000,
  });

  // 2. Fetch update & backup history
  const {
    data: historyRes,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery<
    ApiResponse<{
      items: SystemHistoryRecord[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>
  >({
    queryKey: ["system", "history"],
    queryFn: () => apiGet("/system/history", { page: 1, limit: 25 }),
    staleTime: 10_000,
  });

  const sys = statusRes?.data;

  // Mutation: Create Backup
  const createBackupMutation = useMutation({
    mutationFn: (label: string) =>
      apiPost<ApiResponse<any>>("/system/backups", { label, isKnownGood: true }),
    onSuccess: (res) => {
      setFeedback({
        type: "success",
        message:
          res.message ||
          `Backup '${res.data?.backupId}' created and SHA-256 verified on disk.`,
      });
      queryClient.invalidateQueries({ queryKey: ["system"] });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Backup creation failed.",
      });
    },
  });

  // Mutation: Verify Backup Restore Readiness
  const verifyBackupMutation = useMutation({
    mutationFn: (backupId: string) =>
      apiPost<ApiResponse<any>>("/system/backups/verify", {
        backupId,
        mode: "DRY_RUN_VERIFY",
        reason: "Operator restore readiness verification",
      }),
    onSuccess: (res) => {
      setFeedback({
        type: "success",
        message: `Backup '${res.data?.backupId}' passed SHA-256 & structural restore verification.`,
      });
      queryClient.invalidateQueries({ queryKey: ["system"] });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || err?.message || "Backup verification failed.",
      });
    },
  });

  // Mutation: Validate Update Package
  const validatePackageMutation = useMutation({
    mutationFn: (manifestObj: Record<string, unknown>) =>
      apiPost<ApiResponse<any>>("/system/packages/validate", {
        manifest: manifestObj,
      }),
    onSuccess: (res) => {
      setValidationResult(res.data);
      setFeedback({
        type: res.data?.valid ? "success" : "error",
        message: res.data?.valid
          ? `Package '${res.data.manifest?.packageId}' (v${res.data.targetVersion}) passed all integrity and compatibility checks.`
          : `Package validation failed with ${res.data?.issues?.length || 1} error(s).`,
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || err?.message || "Package validation request failed.",
      });
    },
  });

  // Mutation: Execute Controlled Update
  const executeUpdateMutation = useMutation({
    mutationFn: (payload: { manifest: Record<string, unknown>; reason: string }) =>
      apiPost<ApiResponse<any>>("/system/updates/execute", payload),
    onSuccess: (res) => {
      setConfirmUpdateDialogOpen(false);
      setFeedback({
        type: res.data?.status === "COMPLETED" ? "success" : "error",
        message:
          res.message ||
          `Update finished with state: ${res.data?.status} (Active version: v${res.data?.currentVersion})`,
      });
      queryClient.invalidateQueries({ queryKey: ["system"] });
    },
    onError: (err: any) => {
      setConfirmUpdateDialogOpen(false);
      setFeedback({
        type: "error",
        message:
          err?.response?.data?.message || err?.message || "Controlled update failed.",
      });
      queryClient.invalidateQueries({ queryKey: ["system"] });
    },
  });

  // Mutation: Execute Rollback
  const executeRollbackMutation = useMutation({
    mutationFn: (payload: {
      reason: string;
      restoreDatabaseFromBackup: boolean;
      confirmDataLossWarning: boolean;
    }) => apiPost<ApiResponse<any>>("/system/rollback", payload),
    onSuccess: (res) => {
      setConfirmRollbackDialogOpen(false);
      setFeedback({
        type: "success",
        message:
          res.message ||
          `Rolled back to last known-good version v${res.data?.currentVersion}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["system"] });
    },
    onError: (err: any) => {
      setConfirmRollbackDialogOpen(false);
      setFeedback({
        type: "error",
        message: err?.response?.data?.message || err?.message || "Rollback failed.",
      });
    },
  });

  const handleValidateManifestClick = () => {
    setFeedback(null);
    try {
      const parsed = JSON.parse(manifestJson);
      validatePackageMutation.mutate(parsed);
    } catch {
      setFeedback({
        type: "error",
        message: "Invalid JSON syntax in Version Manifest editor.",
      });
    }
  };

  const handleOpenUpdateConfirm = () => {
    setFeedback(null);
    try {
      JSON.parse(manifestJson);
      setConfirmUpdateDialogOpen(true);
    } catch {
      setFeedback({
        type: "error",
        message: "Invalid JSON syntax in Version Manifest editor.",
      });
    }
  };

  const handleConfirmExecuteUpdate = () => {
    try {
      const parsed = JSON.parse(manifestJson);
      executeUpdateMutation.mutate({
        manifest: parsed,
        reason: updateReason,
      });
    } catch {
      setConfirmUpdateDialogOpen(false);
    }
  };

  const TABS: Array<{ key: LifecycleTab; label: string; badge: string; icon: typeof Server }> =
    [
      {
        key: "OVERVIEW",
        label: "Version & Health Status",
        badge: "Diagnostics",
        icon: Activity,
      },
      {
        key: "UPDATE_MANAGER",
        label: "Controlled Update Manager",
        badge: "Offline Package",
        icon: PackageCheck,
      },
      {
        key: "BACKUPS",
        label: "Database Backups & Verify",
        badge: "Snapshots",
        icon: Database,
      },
      {
        key: "ROLLBACK_RECOVERY",
        label: "Rollback & Recovery",
        badge: "Resilience",
        icon: RotateCcw,
      },
      {
        key: "HISTORY",
        label: "Update Operation Log",
        badge: "Audit Trail",
        icon: History,
      },
    ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Updates, Offline Deployment & Recovery"
        description="Offline package validation, pre-update PostgreSQL backup verification, controlled update state machine, and safe rollback"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "System Updates & Recovery" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refetchStatus();
                refetchHistory();
              }}
              data-testid="refresh-lifecycle-btn"
            >
              <RefreshCw className="size-4 mr-1.5" />
              Refresh Diagnostics
            </Button>
            <Button
              size="sm"
              onClick={() => createBackupMutation.mutate(backupLabel)}
              disabled={createBackupMutation.isPending}
              data-testid="trigger-instant-backup-btn"
            >
              {createBackupMutation.isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Download className="size-4 mr-1.5" />
              )}
              Create Verified Backup
            </Button>
          </div>
        }
      />

      {/* Feedback Banner */}
      {feedback && (
        <div
          data-testid={
            feedback.type === "success" ? "lifecycle-success-banner" : "lifecycle-error-banner"
          }
          className={`rounded-md border px-4 py-3 text-sm flex items-center justify-between ${
            feedback.type === "success"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <span className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 shrink-0" />
            )}
            {feedback.message}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setFeedback(null)}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Top Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Installed Application Version</p>
            <div className="flex items-baseline justify-between mt-1">
              <span
                className="text-xl font-bold font-mono"
                data-testid="installed-version-value"
              >
                v{sys?.currentVersion || "1.4.0"}
              </span>
              <Badge variant="default" className="text-[10px]">
                Schema {sys?.manifest?.components?.databaseSchemaVersion || "2026.11.phase4f"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Update State Machine</p>
            <div className="flex items-center justify-between mt-1">
              <span
                className="text-sm font-bold font-mono"
                data-testid="update-state-badge"
              >
                {sys?.updateState || "IDLE"}
              </span>
              <Badge
                variant={sys?.diagnostics?.status === "HEALTHY" ? "default" : "destructive"}
                className="text-[10px]"
              >
                {sys?.diagnostics?.status || "HEALTHY"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">Last Known-Good Baseline</p>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-base font-semibold font-mono">
                v{sys?.lastKnownGoodVersion || "1.4.0"}
              </span>
              <Badge variant="secondary" className="text-[10px]">
                {sys?.backups?.length || 0} Verified Backups
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground">RFID SQLite Offline Buffer</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs font-semibold flex items-center gap-1.5">
                <Radio className="size-3.5 text-emerald-500" />
                Queue Persistent
              </span>
              <Badge variant="outline" className="text-[10px]">
                WAL Active
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5"
        role="tablist"
        aria-label="System Lifecycle Sections"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const selected = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={selected}
              data-testid={`lifecycle-tab-${t.key.toLowerCase()}`}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <Badge
                  variant={selected ? "default" : "secondary"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {t.badge}
                </Badge>
                <Icon
                  className={`size-4 ${selected ? "text-primary" : "text-muted-foreground"}`}
                />
              </div>
              <span className="text-xs font-semibold leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : activeTab === "OVERVIEW" ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Health Checks Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Post-Update & Recovery Health Checks
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time verification of PostgreSQL connectivity, schema integrity, runtime
                prerequisites, and RFID SQLite buffer
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sys?.diagnostics?.checks?.map((chk) => (
                <div
                  key={chk.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-muted/20"
                >
                  <div>
                    <p className="text-xs font-semibold">{chk.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{chk.details}</p>
                  </div>
                  <Badge
                    variant={chk.status === "PASS" ? "default" : "destructive"}
                    className="text-[10px] shrink-0"
                  >
                    {chk.status}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Architectural Distinction: Offline Package & RFID Buffer vs Cloud Database */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HardDrive className="size-4 text-primary" />
                Offline Architecture & RFID Queue Compatibility
              </CardTitle>
              <CardDescription className="text-xs">
                Clear boundary between offline installation/RFID buffering and PostgreSQL connectivity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="font-semibold text-foreground">
                  1. Offline Package Installation & Controlled Updates (Supported)
                </p>
                <p className="text-muted-foreground mt-1">
                  Frontend dist bundles, backend compiled artifacts, RFID middleware packages,
                  and SHA-256 manifests install locally without requiring internet package
                  registries.
                </p>
              </div>

              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="font-semibold text-foreground">
                  2. RFID SQLite Offline Event Queue (Supported During Outages & Updates)
                </p>
                <p className="text-muted-foreground mt-1">
                  Engine:{" "}
                  <span className="font-mono">
                    {sys?.diagnostics?.rfidOfflineBuffer?.persistenceEngine}
                  </span>
                  . Gate passages and tag scans are persisted locally with{" "}
                  <span className="font-mono">UNIQUE(event_id)</span> idempotency and FIFO
                  ordering during backend restarts or updates.
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                <p className="font-semibold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <Info className="size-4 shrink-0" />
                  3. Transactional PostgreSQL Database Requirement (Documented Limitation)
                </p>
                <p className="text-amber-800 dark:text-amber-200/90 mt-1">
                  {sys?.diagnostics?.deploymentCapabilities?.databaseArchitectureNote}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : activeTab === "UPDATE_MANAGER" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck2 className="size-4 text-primary" />
                Offline Update Package Manifest (`version-manifest.json`)
              </CardTitle>
              <CardDescription className="text-xs">
                Validate SHA-256 archive checksums, minimum supported upgrade version, runtime
                prerequisites, and migration safety before applying
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label
                  htmlFor="manifest-json-editor"
                  className="text-xs font-medium block mb-1"
                >
                  Target Package Version Manifest (JSON)
                </label>
                <textarea
                  id="manifest-json-editor"
                  rows={14}
                  value={manifestJson}
                  onChange={(e) => setManifestJson(e.target.value)}
                  className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs"
                />
              </div>

              <div>
                <label htmlFor="update-reason-input" className="text-xs font-medium block">
                  Administrative Update Justification
                </label>
                <Input
                  id="update-reason-input"
                  value={updateReason}
                  onChange={(e) => setUpdateReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleValidateManifestClick}
                  disabled={validatePackageMutation.isPending}
                  data-testid="validate-package-btn"
                >
                  {validatePackageMutation.isPending ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <PackageCheck className="size-4 mr-1.5" />
                  )}
                  Validate Package Integrity
                </Button>

                <Button
                  size="sm"
                  onClick={handleOpenUpdateConfirm}
                  disabled={executeUpdateMutation.isPending}
                  data-testid="execute-update-btn"
                >
                  {executeUpdateMutation.isPending ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <Play className="size-4 mr-1.5" />
                  )}
                  Execute Controlled Update
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Validation Results & 11-Step Update State Machine
              </CardTitle>
              <CardDescription className="text-xs">
                Automatic pre-update backup, migration check, post-update health verification,
                and safe rollback on failure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {validationResult && (
                <div
                  className="rounded-lg border p-3.5 space-y-2 text-xs"
                  data-testid="package-validation-summary"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      Validation Status: v{validationResult.currentVersion} → v
                      {validationResult.targetVersion}
                    </span>
                    <Badge variant={validationResult.valid ? "default" : "destructive"}>
                      {validationResult.valid ? "VALIDATED" : "REJECTED"}
                    </Badge>
                  </div>

                  {validationResult.issues?.length > 0 && (
                    <ul className="space-y-1 text-destructive font-mono text-[11px] pt-1">
                      {validationResult.issues.map((iss: any, i: number) => (
                        <li key={i}>
                          • [{iss.code}] {iss.field}: {iss.message}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs font-semibold">Latest Update Operation Steps:</p>
                {!sys?.currentOperationSteps || sys.currentOperationSteps.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active update steps recorded in this session. Validate and execute an
                    update package to monitor step-by-step progress.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sys.currentOperationSteps.map((st) => (
                      <div
                        key={st.step}
                        className="rounded border p-2.5 text-xs flex items-start justify-between gap-2"
                      >
                        <div>
                          <span className="font-semibold">
                            Step {st.step}: {st.name}
                          </span>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {st.details}
                          </p>
                        </div>
                        <Badge
                          variant={st.status === "PASSED" ? "default" : "destructive"}
                          className="text-[10px]"
                        >
                          {st.state}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : activeTab === "BACKUPS" ? (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">
                Pre-Update PostgreSQL Backups & Restore Verification
              </CardTitle>
              <CardDescription className="text-xs">
                Every backup is SHA-256 verified on disk and can be tested for restore readiness
                without overwriting the last known-good snapshot
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Backup Snapshot Label"
                value={backupLabel}
                onChange={(e) => setBackupLabel(e.target.value)}
                placeholder="Snapshot label..."
                className="h-8 text-xs w-56"
              />
              <Button
                size="sm"
                onClick={() => createBackupMutation.mutate(backupLabel)}
                disabled={createBackupMutation.isPending}
                data-testid="create-backup-tab-btn"
              >
                Create Snapshot
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!sys?.backups || sys.backups.length === 0 ? (
              <EmptyState
                title="No database backups recorded yet"
                description="Click 'Create Verified Backup' before applying any system update."
              />
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap pl-5">Backup ID</TableHead>
                      <TableHead className="whitespace-nowrap">Label</TableHead>
                      <TableHead className="whitespace-nowrap">Version</TableHead>
                      <TableHead className="whitespace-nowrap">SHA-256 Integrity</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Created At</TableHead>
                      <TableHead className="whitespace-nowrap pr-5 text-right">Restore Verification</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sys.backups.map((bkp) => (
                      <TableRow key={bkp.backupId}>
                        <TableCell className="font-mono text-xs whitespace-nowrap pl-5">{bkp.backupId}</TableCell>
                        <TableCell className="text-xs min-w-[140px]">
                          {bkp.label}
                          {bkp.isKnownGood && (
                            <Badge variant="secondary" className="ml-2 text-[10px] whitespace-nowrap">
                              Known-Good
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">v{bkp.appVersion}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {bkp.sha256.slice(0, 16)}...
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={bkp.status === "CORRUPTED" ? "destructive" : "default"}
                            className="text-[10px]"
                          >
                            {bkp.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDateTime(bkp.createdAt)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => verifyBackupMutation.mutate(bkp.backupId)}
                            disabled={verifyBackupMutation.isPending}
                            data-testid={`verify-backup-${bkp.backupId}`}
                          >
                            Verify Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : activeTab === "ROLLBACK_RECOVERY" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="size-4 text-amber-500" />
                Safe Application Rollback
              </CardTitle>
              <CardDescription className="text-xs">
                Restore the preserved last known-good version while protecting all library
                catalog and circulation records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-lg border p-3 bg-muted/20 space-y-1">
                <p>
                  <span className="font-semibold">Installed Version:</span>{" "}
                  <span className="font-mono">v{sys?.currentVersion}</span>
                </p>
                <p>
                  <span className="font-semibold">Last Known-Good Target:</span>{" "}
                  <span className="font-mono">v{sys?.lastKnownGoodVersion}</span>
                </p>
                <p>
                  <span className="font-semibold">Preserved Backup ID:</span>{" "}
                  <span className="font-mono">
                    {sys?.lastKnownGoodBackupId || "Auto-created on first update"}
                  </span>
                </p>
                <p className="text-muted-foreground pt-1">
                  {sys?.rollbackEligibility?.reason}
                </p>
              </div>

              <div>
                <label htmlFor="rollback-reason-input" className="text-xs font-medium block">
                  Rollback Reason (Required for Audit Log)
                </label>
                <Input
                  id="rollback-reason-input"
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <Button
                size="sm"
                variant="destructive"
                onClick={() => setConfirmRollbackDialogOpen(true)}
                disabled={executeRollbackMutation.isPending}
                data-testid="open-rollback-confirm-btn"
              >
                <RotateCcw className="size-4 mr-1.5" />
                Roll Back to Last Known-Good Version
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Standard Operating Recovery Procedure
              </CardTitle>
              <CardDescription className="text-xs">
                Step-by-step institutional recovery protocol for interrupted updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">1. Automatic Rollback:</span>{" "}
                If an update fails during migration or post-update health checks, SmartLib
                automatically reverts to <span className="font-mono">v{sys?.lastKnownGoodVersion}</span>.
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  2. Zero Library Record Deletion:
                </span>{" "}
                Application rollback never deletes or overwrites books, members, loans, or fine
                records in PostgreSQL.
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  3. RFID Offline Queue Preservation:
                </span>{" "}
                Queued gate and reader events in SQLite remain intact across restarts and
                synchronize automatically once the backend API is healthy.
              </p>
              <p>
                <span className="font-semibold text-foreground">
                  4. CLI Emergency Recovery:
                </span>{" "}
                Administrators can also execute{" "}
                <span className="font-mono">
                  deploy/offline-package/scripts/rollback-smartlib.ps1
                </span>{" "}
                from an elevated PowerShell prompt.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* HISTORY TAB */
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4 text-primary" />
              Update, Backup & Rollback Audit Log
            </CardTitle>
            <CardDescription className="text-xs">
              Chronological ledger of all deployment lifecycle operations executed by
              administrators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !historyRes?.data?.items || historyRes.data.items.length === 0 ? (
              <EmptyState
                title="No lifecycle operations logged yet"
                description="Backups, package updates, and rollbacks will be recorded here."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Operation</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Version Transition</TableHead>
                      <TableHead>Operator</TableHead>
                      <TableHead>Reason / Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRes.data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDateTime(item.timestamp)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{item.operation}</TableCell>
                        <TableCell>
                          <Badge
                            variant={item.state === "FAILED" ? "destructive" : "secondary"}
                            className="text-[10px]"
                          >
                            {item.state}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.previousVersion
                            ? `v${item.previousVersion} → v${item.newVersion}`
                            : item.newVersion
                            ? `v${item.newVersion}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-xs">{item.operator.name}</TableCell>
                        <TableCell className="text-xs">{item.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Controlled Update Confirmation Dialog */}
      <Dialog open={confirmUpdateDialogOpen} onOpenChange={setConfirmUpdateDialogOpen}>
        <DialogContent data-testid="confirm-update-dialog">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <PackageCheck className="size-5 text-primary" />
              Confirm Controlled Application Update
            </DialogTitle>
            <DialogDescription className="text-xs">
              SmartLib will automatically create and SHA-256 verify a pre-update database
              snapshot, validate schema compatibility, apply the update, and run post-update
              health checks.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmUpdateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmExecuteUpdate}
              disabled={executeUpdateMutation.isPending}
              data-testid="confirm-execute-update-btn"
            >
              Confirm & Start Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={confirmRollbackDialogOpen} onOpenChange={setConfirmRollbackDialogOpen}>
        <DialogContent data-testid="confirm-rollback-dialog">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              Confirm System Rollback to Last Known-Good Version
            </DialogTitle>
            <DialogDescription className="text-xs">
              This action will revert the active application version to{" "}
              <span className="font-mono font-semibold">
                v{sys?.lastKnownGoodVersion || "1.4.0"}
              </span>
              . Existing catalog, patron, and circulation records are preserved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={restoreDbOnRollback}
                onChange={(e) => setRestoreDbOnRollback(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Also restore configuration state from pre-update database backup snapshot
              </span>
            </label>

            {restoreDbOnRollback && (
              <div className="rounded border border-destructive/40 bg-destructive/10 p-2.5 text-destructive">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmDataLossAck}
                    onChange={(e) => setConfirmDataLossAck(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    I acknowledge that restoring a database snapshot may overwrite settings
                    modified after the backup timestamp.
                  </span>
                </label>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmRollbackDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                executeRollbackMutation.mutate({
                  reason: rollbackReason,
                  restoreDatabaseFromBackup: restoreDbOnRollback,
                  confirmDataLossWarning: confirmDataLossAck,
                })
              }
              disabled={
                executeRollbackMutation.isPending ||
                (restoreDbOnRollback && !confirmDataLossAck)
              }
              data-testid="confirm-execute-rollback-btn"
            >
              Confirm Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
