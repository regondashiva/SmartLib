import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ReportsAnalyticsPage from "@/pages/reports/ReportsAnalytics";
import * as apiModule from "@/lib/api";

// Mock ResizeObserver for Recharts in JSDOM
(window as any).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock("@/lib/api", () => ({
  apiGet: vi.fn(),
  apiDownload: vi.fn(),
}));

describe("Phase 4D — Frontend Reports & Analytics Page", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    (apiModule.apiGet as any).mockImplementation((url: string) => {
      if (url === "/reports/dashboard") {
        return Promise.resolve({
          success: true,
          data: {
            catalog: { totalTitles: 42, totalPhysicalCopies: 108, rfidTaggedCopies: 95 },
            circulation: { activeLoans: 14, overdueLoans: 3 },
            patrons: { activeMembers: 65, blockedMembers: 2 },
            fines: { outstandingBalance: 120.5 },
            charts: {
              circulationTrend: [{ date: "2026-11-09", issues: 5, returns: 3 }],
              categoryDistribution: [{ name: "Computer Science", value: 25, color: "#2563EB" }],
              inventoryStatusBreakdown: [{ status: "AVAILABLE", count: 94, color: "#10B981" }],
            },
            generatedAt: "2026-11-09T12:00:00.000Z",
          },
        });
      }

      if (url === "/reports/circulation") {
        return Promise.resolve({
          success: true,
          data: {
            summary: {
              totalIssues: 58,
              totalReturns: 44,
              activeLoans: 14,
              overdueLoans: 3,
              totalRenewals: 9,
            },
            trends: {
              daily: [{ period: "2026-11-09", issues: 6, returns: 4, renewals: 1 }],
              weekly: [{ period: "2026-W45", issues: 20, returns: 15 }],
              monthly: [{ month: "2026-11", issues: 58, returns: 44 }],
            },
            mostBorrowedBooks: [
              {
                bookId: "b1",
                title: "Clean Code",
                isbn13: "9780132350884",
                category: "Computer Science",
                borrowCount: 12,
              },
            ],
            records: [
              {
                id: "c1",
                accessionNumber: "ACC-2026-00001",
                bookTitle: "Clean Code",
                category: "Computer Science",
                memberName: "Alex Rivera",
                cardNumber: "STD-2026-1001",
                memberType: "STUDENT",
                department: "Computer Science",
                issuedDate: "2026-11-01T10:00:00.000Z",
                dueDate: "2026-11-15T10:00:00.000Z",
                returnedDate: null,
                renewalCount: 1,
                status: "ACTIVE",
                operator: "Chief Administrator",
              },
            ],
            pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
          },
        });
      }

      if (url === "/reports/overdue") {
        return Promise.resolve({
          success: true,
          data: {
            summary: {
              totalOverdueItems: 2,
              averageOverdueDays: 7,
              totalAccruedFine: 70.0,
              dailyFineRate: 5.0,
            },
            records: [
              {
                id: "o1",
                accessionNumber: "ACC-2026-00099",
                bookTitle: "Distributed Systems",
                category: "Computer Science",
                memberName: "Alex Rivera",
                cardNumber: "STD-2026-1001",
                contactEmail: "alex.rivera@student.institution.edu",
                dueDate: "2026-11-01T10:00:00.000Z",
                overdueDays: 8,
                fineAmount: 40.0,
                status: "OVERDUE",
              },
            ],
            pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
          },
        });
      }

      return Promise.resolve({
        success: true,
        data: {
          summary: {},
          records: [],
          pagination: { page: 1, limit: 15, total: 0, totalPages: 1 },
        },
      });
    });
  });

  function renderPage() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ReportsAnalyticsPage />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("renders report category tabs, filter controls, and live Circulation Report metrics", async () => {
    renderPage();

    expect(screen.getByText("Reports & Institutional Analytics")).toBeTruthy();
    expect(screen.getByTestId("report-tab-circulation")).toBeTruthy();
    expect(screen.getByTestId("report-tab-overdue")).toBeTruthy();
    expect(screen.getByTestId("report-tab-inventory")).toBeTruthy();

    await waitFor(() => {
      expect(screen.getByText("Total Issues")).toBeTruthy();
      expect(screen.getByText("58")).toBeTruthy();
      expect(screen.getByText("ACC-2026-00001")).toBeTruthy();
    });
  });

  it("switches to Overdue Ledger tab and displays overdue records", async () => {
    renderPage();

    const overdueTab = screen.getByTestId("report-tab-overdue");
    fireEvent.click(overdueTab);

    await waitFor(() => {
      expect(screen.getByText("Total Overdue Items")).toBeTruthy();
      expect(screen.getByText("ACC-2026-00099")).toBeTruthy();
      expect(screen.getByText("8 days")).toBeTruthy();
    });
  });

  it("applies filters when Generate Report is clicked", async () => {
    renderPage();

    // Wait for initial query to settle so button is not disabled by isFetching
    await waitFor(() => {
      expect(screen.getByText("Total Issues")).toBeTruthy();
    });

    const deptInput = screen.getByPlaceholderText("e.g. Computer Science");
    fireEvent.change(deptInput, { target: { value: "Electrical Engineering" } });

    const generateBtn = screen.getByTestId("generate-report-btn");
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(apiModule.apiGet).toHaveBeenCalledWith(
        "/reports/circulation",
        expect.objectContaining({ department: "Electrical Engineering" })
      );
    });
  });
});
