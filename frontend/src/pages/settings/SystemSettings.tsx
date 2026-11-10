import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  RotateCcw,
  Globe,
  Shield,
  Bell,
  Radio,
  BookOpen,
  History,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Loader2,
  RefreshCw,
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
import { apiGet, apiPut } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { ApiResponse, SystemSettingsPayload, SettingsHistoryItem } from "@/types";

type SettingsTabKey =
  | "CIRCULATION"
  | "RFID"
  | "SECURITY_GATE"
  | "NOTIFICATIONS"
  | "INSTITUTIONAL"
  | "HISTORY";

const DEFAULT_SETTINGS: SystemSettingsPayload = {
  circulation: {
    studentLoanDurationDays: 14,
    staffLoanDurationDays: 14,
    facultyLoanDurationDays: 30,
    maxRenewals: 2,
    renewalExtensionDays: 14,
    facultyRenewalExtensionDays: 30,
    maxActiveLoansStudent: 4,
    maxActiveLoansStaff: 6,
    maxActiveLoansFaculty: 10,
    maxActiveLoansResearchScholar: 8,
    maxActiveLoansGuest: 2,
    finePerOverdueDay: 5.0,
    fineThresholdForBorrowingRestriction: 25.0,
    enforceReferenceOnlyRestriction: true,
  },
  rfid: {
    mockMode: true,
    eventRetryAttempts: 3,
    eventRetryBackoffMs: 2000,
    duplicateEventWindowSeconds: 5,
    deviceHealthCheckIntervalSeconds: 30,
    offlineBufferEnabled: true,
    offlineBufferMaxRecords: 10000,
  },
  securityGates: {
    gateEventLoggingEnabled: true,
    alertThresholdPerHour: 5,
    easBehavior: "STRICT_ALARM",
    securityEventRetentionDays: 365,
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    dueDateReminderEnabled: true,
    dueDateReminderDaysBefore: 2,
    overdueAlertEnabled: true,
    securityGateAlertEnabled: true,
  },
  institutional: {
    institutionName: "National Institute of Technology",
    libraryName: "Central RFID Knowledge Resource Centre",
    academicYear: "2025-2026",
    timeZone: "Asia/Kolkata",
    currency: "INR",
    contactEmail: "library-admin@smartlib.ac.in",
    contactPhone: "+91-11-2659-7135",
  },
};

export default function SystemSettingsPage() {
  const { user, hasRole } = useAuth();
  const isAdmin = !user || hasRole("ADMIN");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<SettingsTabKey>("CIRCULATION");
  const [formState, setFormState] = useState<SystemSettingsPayload>(DEFAULT_SETTINGS);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(
    null
  );
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [changeReason, setChangeReason] = useState("Routine institutional policy adjustment");

  // 1. Fetch current persisted settings
  const {
    data: settingsRes,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<ApiResponse<SystemSettingsPayload>>({
    queryKey: ["settings", "current"],
    queryFn: () => apiGet<ApiResponse<SystemSettingsPayload>>("/settings"),
    staleTime: 10_000,
  });

  // 2. Fetch configuration audit history
  const {
    data: historyRes,
    isLoading: historyLoading,
    refetch: refetchHistory,
  } = useQuery<
    ApiResponse<{
      items: SettingsHistoryItem[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    }>
  >({
    queryKey: ["settings", "history"],
    queryFn: () => apiGet("/settings/history", { page: 1, limit: 25 }),
    staleTime: 10_000,
  });

  // Sync fetched settings into editable form state
  useEffect(() => {
    if (settingsRes?.data) {
      setFormState({
        circulation: { ...DEFAULT_SETTINGS.circulation, ...settingsRes.data.circulation },
        rfid: { ...DEFAULT_SETTINGS.rfid, ...settingsRes.data.rfid },
        securityGates: { ...DEFAULT_SETTINGS.securityGates, ...settingsRes.data.securityGates },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...settingsRes.data.notifications },
        institutional: { ...DEFAULT_SETTINGS.institutional, ...settingsRes.data.institutional },
      });
    }
  }, [settingsRes]);

  const savedSettings = settingsRes?.data ?? DEFAULT_SETTINGS;

  // Compute whether sensitive fields changed
  const sensitiveChanges = useMemo(() => {
    const changes: string[] = [];
    if (
      formState.circulation.finePerOverdueDay !== savedSettings.circulation?.finePerOverdueDay
    ) {
      changes.push(
        `Daily Overdue Fine: ₹${savedSettings.circulation?.finePerOverdueDay} → ₹${formState.circulation.finePerOverdueDay}`
      );
    }
    if (
      formState.circulation.fineThresholdForBorrowingRestriction !==
      savedSettings.circulation?.fineThresholdForBorrowingRestriction
    ) {
      changes.push(
        `Fine Borrowing Threshold: ₹${savedSettings.circulation?.fineThresholdForBorrowingRestriction} → ₹${formState.circulation.fineThresholdForBorrowingRestriction}`
      );
    }
    if (
      formState.circulation.enforceReferenceOnlyRestriction !==
      savedSettings.circulation?.enforceReferenceOnlyRestriction
    ) {
      changes.push(
        `Reference-Only Restriction: ${savedSettings.circulation?.enforceReferenceOnlyRestriction ? "Enabled" : "Disabled"} → ${formState.circulation.enforceReferenceOnlyRestriction ? "Enabled" : "Disabled"}`
      );
    }
    if (formState.rfid.mockMode !== savedSettings.rfid?.mockMode) {
      changes.push(
        `RFID Mock Mode: ${savedSettings.rfid?.mockMode ? "Enabled" : "Disabled"} → ${formState.rfid.mockMode ? "Enabled" : "Disabled"}`
      );
    }
    if (formState.securityGates.easBehavior !== savedSettings.securityGates?.easBehavior) {
      changes.push(
        `Security Gate EAS Behavior: ${savedSettings.securityGates?.easBehavior} → ${formState.securityGates.easBehavior}`
      );
    }
    return changes;
  }, [formState, savedSettings]);

  // Client-side validation
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};
    const c = formState.circulation;
    const r = formState.rfid;
    const g = formState.securityGates;
    const n = formState.notifications;
    const inst = formState.institutional;

    if (!Number.isInteger(c.studentLoanDurationDays) || c.studentLoanDurationDays < 1 || c.studentLoanDurationDays > 365) {
      errs["studentLoanDurationDays"] = "Student loan duration must be between 1 and 365 days.";
    }
    if (!Number.isInteger(c.staffLoanDurationDays) || c.staffLoanDurationDays < 1 || c.staffLoanDurationDays > 365) {
      errs["staffLoanDurationDays"] = "Staff loan duration must be between 1 and 365 days.";
    }
    if (!Number.isInteger(c.facultyLoanDurationDays) || c.facultyLoanDurationDays < 1 || c.facultyLoanDurationDays > 365) {
      errs["facultyLoanDurationDays"] = "Faculty loan duration must be between 1 and 365 days.";
    }
    if (!Number.isInteger(c.maxRenewals) || c.maxRenewals < 0 || c.maxRenewals > 20) {
      errs["maxRenewals"] = "Maximum renewals must be between 0 and 20.";
    }
    if (!Number.isInteger(c.renewalExtensionDays) || c.renewalExtensionDays < 1 || c.renewalExtensionDays > 180) {
      errs["renewalExtensionDays"] = "Renewal extension period must be between 1 and 180 days.";
    }
    if (!Number.isInteger(c.maxActiveLoansStudent) || c.maxActiveLoansStudent < 1 || c.maxActiveLoansStudent > 50) {
      errs["maxActiveLoansStudent"] = "Student max active loans must be between 1 and 50.";
    }
    if (isNaN(c.finePerOverdueDay) || c.finePerOverdueDay < 0 || c.finePerOverdueDay > 1000) {
      errs["finePerOverdueDay"] = "Fine per overdue day must be between ₹0.00 and ₹1000.00.";
    }
    if (
      isNaN(c.fineThresholdForBorrowingRestriction) ||
      c.fineThresholdForBorrowingRestriction < 0 ||
      c.fineThresholdForBorrowingRestriction > 50000
    ) {
      errs["fineThresholdForBorrowingRestriction"] =
        "Fine borrowing threshold must be between ₹0.00 and ₹50,000.00.";
    }

    if (r.eventRetryAttempts < 0 || r.eventRetryAttempts > 20) {
      errs["eventRetryAttempts"] = "Retry attempts must be between 0 and 20.";
    }
    if (r.duplicateEventWindowSeconds < 1 || r.duplicateEventWindowSeconds > 300) {
      errs["duplicateEventWindowSeconds"] = "Duplicate detection window must be 1–300 seconds.";
    }
    if (r.deviceHealthCheckIntervalSeconds < 5 || r.deviceHealthCheckIntervalSeconds > 3600) {
      errs["deviceHealthCheckIntervalSeconds"] = "Health-check interval must be 5–3600 seconds.";
    }

    if (g.alertThresholdPerHour < 1 || g.alertThresholdPerHour > 500) {
      errs["alertThresholdPerHour"] = "Gate alert threshold must be between 1 and 500 per hour.";
    }
    if (g.securityEventRetentionDays < 30 || g.securityEventRetentionDays > 3650) {
      errs["securityEventRetentionDays"] = "Retention period must be between 30 and 3650 days.";
    }

    if (n.dueDateReminderDaysBefore < 1 || n.dueDateReminderDaysBefore > 30) {
      errs["dueDateReminderDaysBefore"] = "Reminder days before due date must be between 1 and 30.";
    }

    if (!inst.institutionName || inst.institutionName.trim().length < 2) {
      errs["institutionName"] = "Institution name is required (min 2 characters).";
    }
    if (!inst.libraryName || inst.libraryName.trim().length < 2) {
      errs["libraryName"] = "Library name is required (min 2 characters).";
    }
    if (!/^\d{4}-\d{4}$/.test(inst.academicYear.trim())) {
      errs["academicYear"] = "Academic year must be in YYYY-YYYY format (e.g. 2025-2026).";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inst.contactEmail.trim())) {
      errs["contactEmail"] = "Valid institutional contact email is required.";
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Mutation to persist settings
  const saveMutation = useMutation({
    mutationFn: (payload: {
      circulation: SystemSettingsPayload["circulation"];
      rfid: SystemSettingsPayload["rfid"];
      securityGates: SystemSettingsPayload["securityGates"];
      notifications: SystemSettingsPayload["notifications"];
      institutional: SystemSettingsPayload["institutional"];
      reason: string;
    }) => apiPut<ApiResponse<SystemSettingsPayload>>("/settings", payload),
    onSuccess: (res) => {
      setConfirmDialogOpen(false);
      setFeedback({
        type: "success",
        message: res.message || "Institutional policies & system settings saved to Neon PostgreSQL.",
      });
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      refetchHistory();
    },
    onError: (err: any) => {
      setConfirmDialogOpen(false);
      const apiMsg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to update settings. Please check your permissions and input values.";
      setFeedback({ type: "error", message: apiMsg });
    },
  });

  const handleSaveRequest = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setFeedback(null);

    if (!validateForm()) {
      setFeedback({
        type: "error",
        message: "Please resolve the highlighted validation errors before saving.",
      });
      return;
    }

    // If sensitive policies were altered, prompt confirmation modal first
    if (sensitiveChanges.length > 0) {
      setConfirmDialogOpen(true);
      return;
    }

    executeSave();
  };

  const executeSave = () => {
    saveMutation.mutate({
      circulation: formState.circulation,
      rfid: formState.rfid,
      securityGates: formState.securityGates,
      notifications: formState.notifications,
      institutional: formState.institutional,
      reason: changeReason,
    });
  };

  const handleDiscardUnsavedChanges = () => {
    setValidationErrors({});
    setFeedback(null);
    if (settingsRes?.data) {
      setFormState({
        circulation: { ...DEFAULT_SETTINGS.circulation, ...settingsRes.data.circulation },
        rfid: { ...DEFAULT_SETTINGS.rfid, ...settingsRes.data.rfid },
        securityGates: { ...DEFAULT_SETTINGS.securityGates, ...settingsRes.data.securityGates },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...settingsRes.data.notifications },
        institutional: { ...DEFAULT_SETTINGS.institutional, ...settingsRes.data.institutional },
      });
    } else {
      setFormState(DEFAULT_SETTINGS);
    }
  };

  const TABS: Array<{ key: SettingsTabKey; label: string; icon: typeof BookOpen; badge: string }> = [
    { key: "CIRCULATION", label: "Circulation Policies", icon: BookOpen, badge: "Loans & Fines" },
    { key: "RFID", label: "RFID Configuration", icon: Radio, badge: "Middleware" },
    { key: "SECURITY_GATE", label: "Security Gates", icon: Shield, badge: "EAS Portals" },
    { key: "NOTIFICATIONS", label: "Notifications", icon: Bell, badge: "Alerts" },
    { key: "INSTITUTIONAL", label: "Institutional Identity", icon: Globe, badge: "Branding" },
    { key: "HISTORY", label: "Audit History", icon: History, badge: "Compliance" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings & Institutional Policy Configuration"
        description="Centralized institutional loan rules, overdue fine schedules, RFID middleware parameters, and EAS gate policies persisted in Neon PostgreSQL"
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "System Settings" }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                refetch();
                refetchHistory();
              }}
              data-testid="refresh-settings-btn"
            >
              <RefreshCw className="size-4 mr-1.5" />
              Refresh
            </Button>
            {isAdmin && activeTab !== "HISTORY" && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDiscardUnsavedChanges}
                  disabled={saveMutation.isPending}
                  data-testid="reset-settings-btn"
                >
                  <RotateCcw className="size-4 mr-1.5" />
                  Discard Unsaved
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveRequest}
                  disabled={saveMutation.isPending}
                  data-testid="save-settings-btn"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-1.5" />
                  )}
                  Save Configuration
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* RBAC Read-Only Banner for Librarians */}
      {!isAdmin && (
        <div
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5"
          data-testid="readonly-rbac-banner"
        >
          <Lock className="size-4 shrink-0" />
          <div>
            <span className="font-semibold">Read-Only Policy View:</span> You are signed in as{" "}
            <span className="font-mono font-semibold">{user?.role}</span>. Only authorized{" "}
            <span className="font-mono font-semibold">ADMIN</span> accounts may modify institutional
            system settings.
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback && (
        <div
          data-testid={
            feedback.type === "success" ? "settings-success-banner" : "settings-error-banner"
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

      {/* Category Navigation Tabs */}
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5"
        role="tablist"
        aria-label="Settings Categories"
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
              data-testid={`settings-tab-${t.key.toLowerCase()}`}
              onClick={() => setActiveTab(t.key)}
              className={`flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30"
                  : "border-border bg-card hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1.5">
                <Badge variant={selected ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                  {t.badge}
                </Badge>
                <Icon className={`size-4 ${selected ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <span className="text-xs font-semibold leading-tight">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Loading or Error States */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      ) : isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="size-8 text-destructive mx-auto mb-2" />
            <p className="font-semibold text-sm text-destructive">
              Failed to load system settings
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {(error as any)?.response?.data?.message ||
                (error as Error)?.message ||
                "Unable to retrieve configuration from backend."}
            </p>
          </CardContent>
        </Card>
      ) : activeTab === "HISTORY" ? (
        /* ─── Settings Change Audit History Tab ──────────────────────────────── */
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="size-4 text-primary" />
              Configuration Change Audit History
            </CardTitle>
            <CardDescription className="text-xs">
              Immutable ledger of all administrative policy modifications with before/after values
            </CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : !historyRes?.data?.items || historyRes.data.items.length === 0 ? (
              <EmptyState
                title="No configuration changes recorded"
                description="When an administrator updates institutional policies, the audit trail will appear here."
              />
            ) : (
              <div className="w-full max-w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap pl-5">Timestamp</TableHead>
                      <TableHead className="whitespace-nowrap">Administrator</TableHead>
                      <TableHead className="whitespace-nowrap">Reason</TableHead>
                      <TableHead className="whitespace-nowrap pr-5">Changed Fields & Diffs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyRes.data.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs whitespace-nowrap pl-5">
                          {formatDateTime(item.timestamp)}
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          <div className="font-medium">{item.administrator.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {item.administrator.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs min-w-[160px] max-w-[240px]">{item.reason}</TableCell>
                        <TableCell className="text-xs min-w-[200px] pr-5">
                          <div className="flex flex-wrap gap-1.5">
                            {item.changes.map((ch, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 rounded border bg-muted/40 px-2 py-0.5 font-mono text-[11px]"
                              >
                                <span className="font-semibold text-foreground">{ch.key}:</span>
                                <span className="text-muted-foreground">
                                  {String(ch.previousValue)}
                                </span>
                                <span>→</span>
                                <span className="text-primary font-semibold">
                                  {String(ch.newValue)}
                                </span>
                              </span>
                            ))}
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
      ) : (
        /* ─── Active Category Configuration Form ─────────────────────────────── */
        <form onSubmit={handleSaveRequest} className="space-y-6">
          {activeTab === "CIRCULATION" && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Loan Durations & Renewal Rules</CardTitle>
                  <CardDescription className="text-xs">
                    Dynamic checkout periods and renewal limits enforced by the Circulation Engine
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="studentLoanDurationDays" className="text-xs font-medium block">
                        Student Loan (Days)
                      </label>
                      <Input
                        id="studentLoanDurationDays"
                        type="number"
                        disabled={!isAdmin}
                        value={formState.circulation.studentLoanDurationDays}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              studentLoanDurationDays: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["studentLoanDurationDays"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["studentLoanDurationDays"]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="staffLoanDurationDays" className="text-xs font-medium block">
                        Staff Loan (Days)
                      </label>
                      <Input
                        id="staffLoanDurationDays"
                        type="number"
                        disabled={!isAdmin}
                        value={formState.circulation.staffLoanDurationDays}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              staffLoanDurationDays: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["staffLoanDurationDays"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["staffLoanDurationDays"]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="facultyLoanDurationDays" className="text-xs font-medium block">
                        Faculty Loan (Days)
                      </label>
                      <Input
                        id="facultyLoanDurationDays"
                        type="number"
                        disabled={!isAdmin}
                        value={formState.circulation.facultyLoanDurationDays}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              facultyLoanDurationDays: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["facultyLoanDurationDays"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["facultyLoanDurationDays"]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="maxRenewals" className="text-xs font-medium block">
                        Maximum Renewals
                      </label>
                      <Input
                        id="maxRenewals"
                        type="number"
                        disabled={!isAdmin}
                        value={formState.circulation.maxRenewals}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              maxRenewals: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["maxRenewals"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["maxRenewals"]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label htmlFor="renewalExtensionDays" className="text-xs font-medium block">
                        Standard Renewal (Days)
                      </label>
                      <Input
                        id="renewalExtensionDays"
                        type="number"
                        disabled={!isAdmin}
                        value={formState.circulation.renewalExtensionDays}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              renewalExtensionDays: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["renewalExtensionDays"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["renewalExtensionDays"]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="facultyRenewalExtensionDays"
                        className="text-xs font-medium block"
                      >
                        Faculty Renewal (Days)
                      </label>
                      <Input
                        id="facultyRenewalExtensionDays"
                        type="number"
                        disabled={!isAdmin}
                        value={formState.circulation.facultyRenewalExtensionDays}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              facultyRenewalExtensionDays: parseInt(e.target.value, 10) || 0,
                            },
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <p className="text-xs font-semibold mb-2">
                      Maximum Active Loans Per Member Category
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div>
                        <label htmlFor="maxActiveLoansStudent" className="text-xs text-muted-foreground block">
                          Student Limit
                        </label>
                        <Input
                          id="maxActiveLoansStudent"
                          type="number"
                          disabled={!isAdmin}
                          value={formState.circulation.maxActiveLoansStudent}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              circulation: {
                                ...formState.circulation,
                                maxActiveLoansStudent: parseInt(e.target.value, 10) || 0,
                              },
                            })
                          }
                          className="mt-1"
                        />
                        {validationErrors["maxActiveLoansStudent"] && (
                          <p className="text-[11px] text-destructive mt-1">
                            {validationErrors["maxActiveLoansStudent"]}
                          </p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="maxActiveLoansStaff" className="text-xs text-muted-foreground block">
                          Staff Limit
                        </label>
                        <Input
                          id="maxActiveLoansStaff"
                          type="number"
                          disabled={!isAdmin}
                          value={formState.circulation.maxActiveLoansStaff}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              circulation: {
                                ...formState.circulation,
                                maxActiveLoansStaff: parseInt(e.target.value, 10) || 0,
                              },
                            })
                          }
                          className="mt-1"
                        />
                      </div>

                      <div>
                        <label htmlFor="maxActiveLoansFaculty" className="text-xs text-muted-foreground block">
                          Faculty Limit
                        </label>
                        <Input
                          id="maxActiveLoansFaculty"
                          type="number"
                          disabled={!isAdmin}
                          value={formState.circulation.maxActiveLoansFaculty}
                          onChange={(e) =>
                            setFormState({
                              ...formState,
                              circulation: {
                                ...formState.circulation,
                                maxActiveLoansFaculty: parseInt(e.target.value, 10) || 0,
                              },
                            })
                          }
                          className="mt-1"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Overdue Fines & Reference Restrictions
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Decimal-safe financial penalty rates and borrowing block thresholds
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="finePerOverdueDay" className="text-xs font-medium block">
                        Fine Per Overdue Day (₹)
                      </label>
                      <Input
                        id="finePerOverdueDay"
                        type="number"
                        step="0.50"
                        disabled={!isAdmin}
                        value={formState.circulation.finePerOverdueDay}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              finePerOverdueDay: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["finePerOverdueDay"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["finePerOverdueDay"]}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="fineThresholdForBorrowingRestriction"
                        className="text-xs font-medium block"
                      >
                        Fine Threshold for Borrowing Block (₹)
                      </label>
                      <Input
                        id="fineThresholdForBorrowingRestriction"
                        type="number"
                        step="1.00"
                        disabled={!isAdmin}
                        value={formState.circulation.fineThresholdForBorrowingRestriction}
                        onChange={(e) =>
                          setFormState({
                            ...formState,
                            circulation: {
                              ...formState.circulation,
                              fineThresholdForBorrowingRestriction: parseFloat(e.target.value),
                            },
                          })
                        }
                        className="mt-1"
                      />
                      {validationErrors["fineThresholdForBorrowingRestriction"] && (
                        <p className="text-[11px] text-destructive mt-1">
                          {validationErrors["fineThresholdForBorrowingRestriction"]}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between gap-4">
                    <div>
                      <label
                        htmlFor="enforceReferenceOnlyRestriction"
                        className="text-xs font-semibold block"
                      >
                        Enforce Reference-Only Book Restrictions
                      </label>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Automatically block checkout and renewal requests on copies flagged as
                        Non-Circulating Reference Material.
                      </p>
                    </div>
                    <input
                      id="enforceReferenceOnlyRestriction"
                      type="checkbox"
                      disabled={!isAdmin}
                      checked={formState.circulation.enforceReferenceOnlyRestriction}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          circulation: {
                            ...formState.circulation,
                            enforceReferenceOnlyRestriction: e.target.checked,
                          },
                        })
                      }
                      className="size-4 accent-primary"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "RFID" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">RFID Hardware & Middleware Configuration</CardTitle>
                <CardDescription className="text-xs">
                  Configure reader emulation, event retry backoff, deduplication windows, and offline SQLite buffering
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
                  <div>
                    <label htmlFor="rfidMockMode" className="text-xs font-semibold block">
                      RFID Hardware Mock / Emulator Mode
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      When enabled, allows virtual EPC tag scanning without physical UHF/HF readers attached.
                    </p>
                  </div>
                  <input
                    id="rfidMockMode"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.rfid.mockMode}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: { ...formState.rfid, mockMode: e.target.checked },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>

                <div>
                  <label htmlFor="eventRetryAttempts" className="text-xs font-medium block">
                    Event Retry Attempts
                  </label>
                  <Input
                    id="eventRetryAttempts"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.rfid.eventRetryAttempts}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: {
                          ...formState.rfid,
                          eventRetryAttempts: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="eventRetryBackoffMs" className="text-xs font-medium block">
                    Retry Backoff Interval (ms)
                  </label>
                  <Input
                    id="eventRetryBackoffMs"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.rfid.eventRetryBackoffMs}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: {
                          ...formState.rfid,
                          eventRetryBackoffMs: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="duplicateEventWindowSeconds" className="text-xs font-medium block">
                    Duplicate Event Detection Window (s)
                  </label>
                  <Input
                    id="duplicateEventWindowSeconds"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.rfid.duplicateEventWindowSeconds}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: {
                          ...formState.rfid,
                          duplicateEventWindowSeconds: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <label
                    htmlFor="deviceHealthCheckIntervalSeconds"
                    className="text-xs font-medium block"
                  >
                    Device Health-Check Interval (s)
                  </label>
                  <Input
                    id="deviceHealthCheckIntervalSeconds"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.rfid.deviceHealthCheckIntervalSeconds}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: {
                          ...formState.rfid,
                          deviceHealthCheckIntervalSeconds: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="offlineBufferMaxRecords" className="text-xs font-medium block">
                    Offline Buffer Max Capacity (Records)
                  </label>
                  <Input
                    id="offlineBufferMaxRecords"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.rfid.offlineBufferMaxRecords}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: {
                          ...formState.rfid,
                          offlineBufferMaxRecords: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div className="rounded-lg border p-3 bg-muted/20 flex items-center justify-between">
                  <label htmlFor="offlineBufferEnabled" className="text-xs font-medium">
                    Enable Offline Event Buffer
                  </label>
                  <input
                    id="offlineBufferEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.rfid.offlineBufferEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        rfid: { ...formState.rfid, offlineBufferEnabled: e.target.checked },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "SECURITY_GATE" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">EAS Security Gate Configuration</CardTitle>
                <CardDescription className="text-xs">
                  Portal passage logging, alarm escalation thresholds, EAS bit enforcement, and retention policy
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between sm:col-span-2">
                  <div>
                    <label htmlFor="gateEventLoggingEnabled" className="text-xs font-semibold block">
                      Enable Security Gate Event Logging
                    </label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Record all authorized and unauthorized pedestal passages along with footfall and CCTV timestamps.
                    </p>
                  </div>
                  <input
                    id="gateEventLoggingEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.securityGates.gateEventLoggingEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        securityGates: {
                          ...formState.securityGates,
                          gateEventLoggingEnabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>

                <div>
                  <label htmlFor="easBehavior" className="text-xs font-medium block">
                    EAS Security Gate Behavior
                  </label>
                  <select
                    id="easBehavior"
                    disabled={!isAdmin}
                    value={formState.securityGates.easBehavior}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        securityGates: {
                          ...formState.securityGates,
                          easBehavior: e.target.value as any,
                        },
                      })
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs mt-1"
                  >
                    <option value="STRICT_ALARM">STRICT_ALARM (Sound Audible Siren & Strobe)</option>
                    <option value="SILENT_LOG">SILENT_LOG (Log Incident Only)</option>
                    <option value="DISABLED">DISABLED (Bypass EAS Verification)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="alertThresholdPerHour" className="text-xs font-medium block">
                    Escalation Alert Threshold (Alarms / Hour)
                  </label>
                  <Input
                    id="alertThresholdPerHour"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.securityGates.alertThresholdPerHour}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        securityGates: {
                          ...formState.securityGates,
                          alertThresholdPerHour: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div>
                  <label htmlFor="securityEventRetentionDays" className="text-xs font-medium block">
                    Security Event Retention Period (Days)
                  </label>
                  <Input
                    id="securityEventRetentionDays"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.securityGates.securityEventRetentionDays}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        securityGates: {
                          ...formState.securityGates,
                          securityEventRetentionDays: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "NOTIFICATIONS" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Automated Patron & Staff Notifications</CardTitle>
                <CardDescription className="text-xs">
                  Email and SMS communication channels for due reminders, overdue alerts, and gate alarms
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between">
                  <div>
                    <label htmlFor="emailEnabled" className="text-xs font-semibold block">
                      Email Notifications
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Send institutional emails for loan receipts and notices
                    </p>
                  </div>
                  <input
                    id="emailEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.notifications.emailEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        notifications: {
                          ...formState.notifications,
                          emailEnabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>

                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between">
                  <div>
                    <label htmlFor="smsEnabled" className="text-xs font-semibold block">
                      SMS Text Notifications
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Dispatch SMS alerts for urgent overdue and fine notices
                    </p>
                  </div>
                  <input
                    id="smsEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.notifications.smsEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        notifications: {
                          ...formState.notifications,
                          smsEnabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>

                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between">
                  <div>
                    <label htmlFor="dueDateReminderEnabled" className="text-xs font-semibold block">
                      Courtesy Due-Date Reminders
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Notify borrowers prior to loan expiration
                    </p>
                  </div>
                  <input
                    id="dueDateReminderEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.notifications.dueDateReminderEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        notifications: {
                          ...formState.notifications,
                          dueDateReminderEnabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>

                <div>
                  <label htmlFor="dueDateReminderDaysBefore" className="text-xs font-medium block">
                    Reminder Lead Time (Days Before Due Date)
                  </label>
                  <Input
                    id="dueDateReminderDaysBefore"
                    type="number"
                    disabled={!isAdmin}
                    value={formState.notifications.dueDateReminderDaysBefore}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        notifications: {
                          ...formState.notifications,
                          dueDateReminderDaysBefore: parseInt(e.target.value, 10) || 0,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>

                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between">
                  <div>
                    <label htmlFor="overdueAlertEnabled" className="text-xs font-semibold block">
                      Automated Overdue Alerts
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Alert borrowers when loans transition to OVERDUE
                    </p>
                  </div>
                  <input
                    id="overdueAlertEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.notifications.overdueAlertEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        notifications: {
                          ...formState.notifications,
                          overdueAlertEnabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>

                <div className="rounded-lg border p-3.5 bg-muted/20 flex items-center justify-between">
                  <div>
                    <label htmlFor="securityGateAlertEnabled" className="text-xs font-semibold block">
                      Security Gate Alarm Alerts
                    </label>
                    <p className="text-[11px] text-muted-foreground">
                      Notify staff stations immediately upon EAS gate trigger
                    </p>
                  </div>
                  <input
                    id="securityGateAlertEnabled"
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={formState.notifications.securityGateAlertEnabled}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        notifications: {
                          ...formState.notifications,
                          securityGateAlertEnabled: e.target.checked,
                        },
                      })
                    }
                    className="size-4 accent-primary"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "INSTITUTIONAL" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Institutional Identity & Localization</CardTitle>
                <CardDescription className="text-xs">
                  Institution name, library title, academic year, time zone, currency, and contact details used on reports
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="institutionName" className="text-xs font-medium block">
                    Institution Name
                  </label>
                  <Input
                    id="institutionName"
                    disabled={!isAdmin}
                    value={formState.institutional.institutionName}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          institutionName: e.target.value,
                        },
                      })
                    }
                    className="mt-1"
                  />
                  {validationErrors["institutionName"] && (
                    <p className="text-[11px] text-destructive mt-1">
                      {validationErrors["institutionName"]}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="libraryName" className="text-xs font-medium block">
                    Library Name
                  </label>
                  <Input
                    id="libraryName"
                    disabled={!isAdmin}
                    value={formState.institutional.libraryName}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          libraryName: e.target.value,
                        },
                      })
                    }
                    className="mt-1"
                  />
                  {validationErrors["libraryName"] && (
                    <p className="text-[11px] text-destructive mt-1">
                      {validationErrors["libraryName"]}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="academicYear" className="text-xs font-medium block">
                    Academic Year (YYYY-YYYY)
                  </label>
                  <Input
                    id="academicYear"
                    disabled={!isAdmin}
                    value={formState.institutional.academicYear}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          academicYear: e.target.value,
                        },
                      })
                    }
                    className="mt-1 font-mono"
                  />
                  {validationErrors["academicYear"] && (
                    <p className="text-[11px] text-destructive mt-1">
                      {validationErrors["academicYear"]}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="timeZone" className="text-xs font-medium block">
                    Time Zone
                  </label>
                  <Input
                    id="timeZone"
                    disabled={!isAdmin}
                    value={formState.institutional.timeZone}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          timeZone: e.target.value,
                        },
                      })
                    }
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="currency" className="text-xs font-medium block">
                    Currency Code
                  </label>
                  <Input
                    id="currency"
                    disabled={!isAdmin}
                    value={formState.institutional.currency}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          currency: e.target.value,
                        },
                      })
                    }
                    className="mt-1 font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="contactEmail" className="text-xs font-medium block">
                    Official Contact Email
                  </label>
                  <Input
                    id="contactEmail"
                    type="email"
                    disabled={!isAdmin}
                    value={formState.institutional.contactEmail}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          contactEmail: e.target.value,
                        },
                      })
                    }
                    className="mt-1"
                  />
                  {validationErrors["contactEmail"] && (
                    <p className="text-[11px] text-destructive mt-1">
                      {validationErrors["contactEmail"]}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="contactPhone" className="text-xs font-medium block">
                    Official Contact Phone
                  </label>
                  <Input
                    id="contactPhone"
                    disabled={!isAdmin}
                    value={formState.institutional.contactPhone}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        institutional: {
                          ...formState.institutional,
                          contactPhone: e.target.value,
                        },
                      })
                    }
                    className="mt-1"
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      )}

      {/* Confirmation Dialog Before Applying Sensitive Policy Changes */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent data-testid="sensitive-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-5 text-amber-500" />
              Confirm Sensitive Institutional Policy Change
            </DialogTitle>
            <DialogDescription className="text-xs">
              You are modifying high-impact financial, security, or circulation policies that
              immediately govern live library operations:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <ul className="rounded-md border bg-muted/40 p-3 space-y-1.5 text-xs font-mono">
              {sensitiveChanges.map((change, idx) => (
                <li key={idx} className="text-foreground">
                  • {change}
                </li>
              ))}
            </ul>

            <div>
              <label htmlFor="policy-change-reason" className="text-xs font-medium block">
                Administrative Justification (Recorded in Audit Log)
              </label>
              <Input
                id="policy-change-reason"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Enter justification for audit log..."
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
              disabled={saveMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={executeSave}
              disabled={saveMutation.isPending}
              data-testid="confirm-save-settings-btn"
            >
              {saveMutation.isPending ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4 mr-1.5" />
              )}
              Confirm & Apply Policy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
