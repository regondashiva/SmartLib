import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import BackupUpdatesPage from "@/pages/backup/BackupUpdates";
import * as apiModule from "@/lib/api";

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const MOCK_VERSION_STATUS = {
  currentVersion: "1.4.0",
  lastKnownGoodVersion: "1.4.0",
  lastKnownGoodBackupId: "bkp-1.4.0-2026-11-09T12-00-00Z",
  updateState: "IDLE",
  isOperationInProgress: false,
  currentOperationSteps: [
    {
      step: 1,
      name: "Discover & Validate Update Package Manifest",
      state: "COMPLETED",
      status: "PASSED",
      timestamp: "2026-11-09T12:00:00.000Z",
      details: "Package integrity verified",
    },
  ],
  lastError: null,
  manifest: {
    packageId: "smartlib-offline-release-1.4.0",
    appVersion: "1.4.0",
    minSupportedUpgradeVersion: "1.0.0",
    buildTimestamp: "2026-11-09T10:00:00.000Z",
    components: {
      frontendVersion: "1.4.0",
      backendVersion: "1.4.0",
      rfidMiddlewareVersion: "1.2.0",
      databaseSchemaVersion: "2026.11.phase4f",
    },
    requiredRuntimes: {
      nodeMinVersion: "20.0.0",
      pythonMinVersion: "3.11.0",
      postgresqlMinVersion: "15.0",
      supportedOs: ["Windows 11", "Windows Server 2022"],
    },
    migrations: {
      requiresSchemaMigration: false,
      backwardCompatible: true,
      destructiveChanges: false,
      migrationFiles: ["0001_initial_schema.sql"],
    },
    checksums: {},
    releaseNotes: ["Phase 4F release"],
  },
  rollbackEligibility: {
    eligible: true,
    targetVersion: "1.4.0",
    lastKnownGoodBackupId: "bkp-1.4.0-2026-11-09T12-00-00Z",
    reason: "Rollback available to last known-good version v1.4.0",
  },
  backups: [
    {
      backupId: "bkp-1.4.0-2026-11-09T12-00-00Z",
      label: "Pre-Update Snapshot",
      createdAt: "2026-11-09T12:00:00.000Z",
      appVersion: "1.4.0",
      schemaVersion: "2026.11.phase4f",
      status: "VERIFIED",
      isKnownGood: true,
      sizeBytes: 4096,
      sha256: "a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123",
      tableCounts: { books: 10, members: 25 },
      restoreVerifiedAt: null,
      createdByEmail: "admin@smartlib.ac.in",
    },
  ],
  diagnostics: {
    status: "HEALTHY",
    timestamp: "2026-11-09T12:05:00.000Z",
    checks: [
      {
        id: "database_connectivity",
        name: "PostgreSQL Database Connectivity",
        status: "PASS",
        details: "Connected to Neon PostgreSQL (18 ms latency)",
      },
      {
        id: "rfid_offline_queue",
        name: "RFID SQLite Offline Event Buffer Compatibility",
        status: "PASS",
        details: "SQLite 3 Local WAL Journal | Idempotency: UNIQUE(event_id)",
      },
    ],
    rfidOfflineBuffer: {
      available: true,
      persistenceEngine: "SQLite 3 Local WAL Journal (Initialized & Active)",
      pendingEvents: 0,
      syncedEvents: 12,
      failedEvents: 0,
      idempotencyConstraint: "UNIQUE(event_id) + hardware_timestamp preservation",
      orderingGuarantee: "FIFO ascending sequence (ORDER BY id ASC)",
      survivesUpdateAndRestart: true,
    },
    deploymentCapabilities: {
      offlinePackageInstallation: true,
      rfidOfflineEventBuffering: true,
      fullApplicationOfflineDatabaseMode: false,
      databaseArchitectureNote:
        "SmartLib uses Neon Serverless PostgreSQL as its primary transactional database.",
    },
  },
};

const MOCK_HISTORY = {
  items: [
    {
      id: "log-1",
      timestamp: "2026-11-09T12:10:00.000Z",
      entityName: "SystemUpdate",
      entityId: "smartlib-offline-release-1.5.0",
      operation: "UPDATE_COMPLETED",
      state: "COMPLETED",
      previousVersion: "1.4.0",
      newVersion: "1.5.0",
      backupId: "bkp-1.4.0-2026-11-09T12-00-00Z",
      reason: "Scheduled offline release update",
      error: null,
      operator: {
        name: "Chief Administrator",
        email: "admin@smartlib.ac.in",
      },
    },
  ],
  pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

describe("Phase 4F — Frontend System Updates, Offline Deployment & Recovery Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (apiModule.apiGet as any).mockImplementation((url: string) => {
      if (url === "/system/version") {
        return Promise.resolve({
          success: true,
          data: MOCK_VERSION_STATUS,
        });
      }
      if (url === "/system/history") {
        return Promise.resolve({
          success: true,
          data: MOCK_HISTORY,
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    (apiModule.apiPost as any).mockImplementation((url: string) => {
      if (url === "/system/packages/validate") {
        return Promise.resolve({
          success: true,
          data: {
            valid: true,
            currentVersion: "1.4.0",
            targetVersion: "1.5.0",
            manifest: { packageId: "smartlib-offline-release-1.5.0" },
            issues: [],
          },
        });
      }
      if (url === "/system/backups") {
        return Promise.resolve({
          success: true,
          data: { backupId: "bkp-new-1.4.0" },
          message: "Database backup created and SHA-256 verified",
        });
      }
      if (url === "/system/backups/verify") {
        return Promise.resolve({
          success: true,
          data: { backupId: "bkp-1.4.0-2026-11-09T12-00-00Z", restorable: true },
        });
      }
      if (url === "/system/updates/execute") {
        return Promise.resolve({
          success: true,
          data: { status: "COMPLETED", currentVersion: "1.5.0" },
          message: "Application update completed and verified",
        });
      }
      if (url === "/system/rollback") {
        return Promise.resolve({
          success: true,
          data: { status: "ROLLED_BACK", currentVersion: "1.4.0" },
          message: "System rolled back to last known-good version",
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <BackupUpdatesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("1. Renders installed version, update state machine, health checks, and RFID queue compatibility", async () => {
    renderPage();

    expect(
      screen.getByText("System Updates, Offline Deployment & Recovery")
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByTestId("installed-version-value").textContent).toBe("v1.4.0");
      expect(screen.getByText("PostgreSQL Database Connectivity")).toBeTruthy();
      expect(
        screen.getByText("RFID SQLite Offline Event Buffer Compatibility")
      ).toBeTruthy();
    });
  });

  it("2. Validates an offline update package manifest and executes a controlled update with confirmation", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("lifecycle-tab-update_manager")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("lifecycle-tab-update_manager"));

    fireEvent.click(screen.getByTestId("validate-package-btn"));

    await waitFor(() => {
      expect(apiModule.apiPost).toHaveBeenCalledWith(
        "/system/packages/validate",
        expect.anything()
      );
      expect(screen.getByTestId("package-validation-summary")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("execute-update-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-update-dialog")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("confirm-execute-update-btn"));

    await waitFor(() => {
      expect(apiModule.apiPost).toHaveBeenCalledWith(
        "/system/updates/execute",
        expect.anything()
      );
      expect(screen.getByTestId("lifecycle-success-banner")).toBeTruthy();
    });
  });

  it("3. Displays verified database backups and triggers restore verification", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("lifecycle-tab-backups")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("lifecycle-tab-backups"));

    await waitFor(() => {
      expect(screen.getByText("bkp-1.4.0-2026-11-09T12-00-00Z")).toBeTruthy();
    });

    fireEvent.click(
      screen.getByTestId("verify-backup-bkp-1.4.0-2026-11-09T12-00-00Z")
    );

    await waitFor(() => {
      expect(apiModule.apiPost).toHaveBeenCalledWith(
        "/system/backups/verify",
        expect.objectContaining({
          backupId: "bkp-1.4.0-2026-11-09T12-00-00Z",
          mode: "DRY_RUN_VERIFY",
        })
      );
    });
  });

  it("4. Prompts confirmation before rolling back to last known-good version and displays update history", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("lifecycle-tab-rollback_recovery")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("lifecycle-tab-rollback_recovery"));

    fireEvent.click(screen.getByTestId("open-rollback-confirm-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("confirm-rollback-dialog")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("confirm-execute-rollback-btn"));

    await waitFor(() => {
      expect(apiModule.apiPost).toHaveBeenCalledWith(
        "/system/rollback",
        expect.anything()
      );
    });

    fireEvent.click(screen.getByTestId("lifecycle-tab-history"));

    await waitFor(() => {
      expect(screen.getByText("UPDATE_COMPLETED")).toBeTruthy();
      expect(screen.getByText("Chief Administrator")).toBeTruthy();
    });
  });
});

