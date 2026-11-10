import { test, expect } from "@playwright/test";

test.describe("Phase 4D: Advanced Reports & Analytics E2E Workflow", () => {
  test.setTimeout(90000);

  test("Admin navigates to Reports & Analytics, switches report categories, applies filters, and exports PDF & CSV", async ({
    page,
  }) => {
    // 1. Login as Admin
    await page.goto("http://localhost:5173/login");
    await page.fill('input[type="email"]', "admin@smartlib.ac.in");
    await page.fill('input[type="password"]', "Admin@SmartLib2026!");
    await page.click('button[type="submit"]');
    await page.waitForURL("http://localhost:5173/");

    // 2. Navigate to /reports
    await page.goto("http://localhost:5173/reports");
    await page.waitForLoadState("networkidle");

    // Verify heading & report category tabs
    await expect(
      page.getByRole("heading", { name: /Reports & Institutional Analytics/i })
    ).toBeVisible();

    await expect(page.getByTestId("report-tab-circulation")).toBeVisible();
    await expect(page.getByTestId("report-tab-overdue")).toBeVisible();
    await expect(page.getByTestId("report-tab-inventory")).toBeVisible();
    await expect(page.getByTestId("report-tab-fines")).toBeVisible();
    await expect(page.getByTestId("report-tab-security_gates")).toBeVisible();

    // 3. Verify Circulation Report summary metrics load
    await expect(page.getByTestId("report-summary-metrics")).toBeVisible({ timeout: 20000 });
    await expect(page.locator("text=Total Issues").first()).toBeVisible();

    // 4. Switch through report categories and verify real metrics render
    await page.getByTestId("report-tab-inventory").click();
    await expect(page.locator("text=Total Physical Copies").first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId("report-tab-fines").click();
    await expect(page.locator("text=Total Assessed Fines").first()).toBeVisible({
      timeout: 15000,
    });

    await page.getByTestId("report-tab-migrations").click();
    await expect(page.locator("text=Uploaded Batches").first()).toBeVisible({
      timeout: 15000,
    });

    // 5. Apply filters and click Generate Report
    await page.getByTestId("report-tab-circulation").click();
    await page.fill("#filter-academic-year", "2025-2026");
    await page.getByTestId("generate-report-btn").click();
    await expect(page.getByTestId("report-summary-metrics")).toBeVisible({ timeout: 15000 });

    // 6. Trigger CSV Export and verify download / confirmation banner
    const csvDownloadPromise = page.waitForEvent("download", { timeout: 25000 }).catch(() => null);
    await page.getByTestId("export-csv-btn").click();
    const csvDownload = await csvDownloadPromise;
    if (csvDownload) {
      expect(csvDownload.suggestedFilename()).toContain(".csv");
    }
    await expect(page.getByTestId("export-success-banner")).toBeVisible({ timeout: 20000 });

    // 7. Trigger PDF Export and verify download / confirmation banner
    const pdfDownloadPromise = page.waitForEvent("download", { timeout: 25000 }).catch(() => null);
    await page.getByTestId("export-pdf-btn").click();
    const pdfDownload = await pdfDownloadPromise;
    if (pdfDownload) {
      expect(pdfDownload.suggestedFilename()).toContain(".pdf");
    }
    await expect(page.getByTestId("export-success-banner")).toBeVisible({ timeout: 20000 });

    await page.screenshot({
      path: "reports-analytics-verified.png",
      fullPage: true,
    });
  });
});

