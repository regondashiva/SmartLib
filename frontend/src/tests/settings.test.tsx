import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import SystemSettingsPage from "@/pages/settings/SystemSettings";
import * as apiModule from "@/lib/api";

let mockUserRole: "ADMIN" | "LIBRARIAN" = "ADMIN";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      firstName: mockUserRole === "ADMIN" ? "Chief" : "Senior",
      lastName: mockUserRole === "ADMIN" ? "Administrator" : "Librarian",
      email: mockUserRole === "ADMIN" ? "admin@smartlib.ac.in" : "librarian@smartlib.ac.in",
      role: mockUserRole,
    },
    isAuthenticated: true,
    hasRole: (...roles: string[]) => roles.includes(mockUserRole),
  }),
}));

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

const MOCK_SETTINGS_DATA = {
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

const MOCK_HISTORY_DATA = {
  items: [
    {
      id: "hist-1",
      timestamp: "2026-11-09T12:15:00.000Z",
      administrator: {
        id: "user-1",
        name: "Chief Administrator",
        email: "admin@smartlib.ac.in",
        role: "ADMIN",
      },
      reason: "Annual circulation policy review",
      changedFields: ["DAILY_FINE_RATE", "STUDENT_LOAN_DURATION_DAYS"],
      changes: [
        { key: "DAILY_FINE_RATE", previousValue: "5.00", newValue: "10.00" },
        { key: "STUDENT_LOAN_DURATION_DAYS", previousValue: "14", newValue: "21" },
      ],
      previousState: { DAILY_FINE_RATE: "5.00", STUDENT_LOAN_DURATION_DAYS: "14" },
      newState: { DAILY_FINE_RATE: "10.00", STUDENT_LOAN_DURATION_DAYS: "21" },
      ipAddress: "127.0.0.1",
    },
  ],
  pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

describe("Phase 4E — Frontend System Settings & Institutional Policy Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRole = "ADMIN";
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    (apiModule.apiGet as any).mockImplementation((url: string) => {
      if (url === "/settings") {
        return Promise.resolve({
          success: true,
          data: MOCK_SETTINGS_DATA,
          message: "Settings retrieved",
        });
      }
      if (url === "/settings/history") {
        return Promise.resolve({
          success: true,
          data: MOCK_HISTORY_DATA,
          message: "History retrieved",
        });
      }
      return Promise.resolve({ success: true, data: {} });
    });

    (apiModule.apiPut as any).mockImplementation((_url: string, body: any) =>
      Promise.resolve({
        success: true,
        data: {
          ...MOCK_SETTINGS_DATA,
          ...body,
        },
        message: "Institutional system settings updated successfully",
      })
    );
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SystemSettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

  it("1. Renders all 6 category navigation tabs and loads persisted Circulation Policies", async () => {
    renderPage();

    expect(
      screen.getByText("System Settings & Institutional Policy Configuration")
    ).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Loan Durations & Renewal Rules")).toBeTruthy();
    });

    expect(screen.getByTestId("settings-tab-circulation")).toBeTruthy();
    expect(screen.getByTestId("settings-tab-rfid")).toBeTruthy();
    expect(screen.getByTestId("settings-tab-security_gate")).toBeTruthy();
    expect(screen.getByTestId("settings-tab-notifications")).toBeTruthy();
    expect(screen.getByTestId("settings-tab-institutional")).toBeTruthy();
    expect(screen.getByTestId("settings-tab-history")).toBeTruthy();

    const studentInput = screen.getByLabelText(/Student Loan \(Days\)/i) as HTMLInputElement;
    expect(studentInput.value).toBe("14");
  });

  it("2. Switches between RFID, Security Gate, Notification, and Institutional categories", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Loan Durations & Renewal Rules")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("settings-tab-rfid"));
    expect(screen.getByText("RFID Hardware & Middleware Configuration")).toBeTruthy();

    fireEvent.click(screen.getByTestId("settings-tab-security_gate"));
    expect(screen.getByText("EAS Security Gate Configuration")).toBeTruthy();

    fireEvent.click(screen.getByTestId("settings-tab-notifications"));
    expect(screen.getByText("Automated Patron & Staff Notifications")).toBeTruthy();

    fireEvent.click(screen.getByTestId("settings-tab-institutional"));
    expect(screen.getByText("Institutional Identity & Localization")).toBeTruthy();
    const instInput = screen.getByLabelText(/Institution Name/i) as HTMLInputElement;
    expect(instInput.value).toBe("National Institute of Technology");
  });

  it("3. Validates invalid input values client-side and blocks API submission", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Student Loan \(Days\)/i)).toBeTruthy();
    });

    const studentLoanInput = screen.getByLabelText(/Student Loan \(Days\)/i);
    fireEvent.change(studentLoanInput, { target: { value: "0" } });

    fireEvent.click(screen.getByTestId("save-settings-btn"));

    await waitFor(() => {
      expect(
        screen.getByText("Student loan duration must be between 1 and 365 days.")
      ).toBeTruthy();
      expect(screen.getByTestId("settings-error-banner")).toBeTruthy();
    });

    expect(apiModule.apiPut).not.toHaveBeenCalled();
  });

  it("4. Prompts confirmation modal before applying sensitive policy changes (e.g. Daily Fine Rate)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/Fine Per Overdue Day/i)).toBeTruthy();
    });

    const fineRateInput = screen.getByLabelText(/Fine Per Overdue Day/i);
    fireEvent.change(fineRateInput, { target: { value: "10" } });

    fireEvent.click(screen.getByTestId("save-settings-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("sensitive-confirm-dialog")).toBeTruthy();
      expect(
        screen.getByText(/Confirm Sensitive Institutional Policy Change/i)
      ).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("confirm-save-settings-btn"));

    await waitFor(() => {
      expect(apiModule.apiPut).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("settings-success-banner")).toBeTruthy();
    });
  });

  it("5. Enforces Read-Only RBAC mode when signed in as LIBRARIAN", async () => {
    mockUserRole = "LIBRARIAN";
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("readonly-rbac-banner")).toBeTruthy();
      expect(screen.getByLabelText(/Student Loan \(Days\)/i)).toBeTruthy();
    });

    expect(screen.getByText(/Read-Only Policy View:/i)).toBeTruthy();
    expect(screen.queryByTestId("save-settings-btn")).toBeNull();

    const studentInput = screen.getByLabelText(/Student Loan \(Days\)/i) as HTMLInputElement;
    expect(studentInput.disabled).toBe(true);
  });

  it("6. Renders Configuration Change Audit History with administrator, reason, and field diffs", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("settings-tab-history")).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId("settings-tab-history"));

    await waitFor(() => {
      expect(screen.getByText("Configuration Change Audit History")).toBeTruthy();
      expect(screen.getByText("Chief Administrator")).toBeTruthy();
      expect(screen.getByText("Annual circulation policy review")).toBeTruthy();
      expect(screen.getByText("DAILY_FINE_RATE:")).toBeTruthy();
    });
  });
});
