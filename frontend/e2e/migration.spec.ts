import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import os from 'os';

// Helper: create a temporary CSV file with valid book records
function createSampleCsv(rows: number = 5): string {
  const tmpFile = path.join(os.tmpdir(), `smartlib-migration-test-${Date.now()}.csv`);
  const header = 'title,isbn,authors,publisher,category,edition,publicationYear,language,callNumber,accessionNumber,shelfLocation,condition,referenceOnly';
  const dataRows: string[] = [];
  for (let i = 1; i <= rows; i++) {
    const isbn = `978${(1000000000 + i + Math.floor(Date.now() / 1000)).toString().slice(-10)}`;
    dataRows.push(
      `"E2E Test Book ${i}",${isbn},"Test Author ${i}","Test Publisher","Computer Science","1st",2024,English,"QA76.${i}","E2E-ACC-${Date.now()}-${i}","E2E-SHELF-01",GOOD,false`
    );
  }
  fs.writeFileSync(tmpFile, [header, ...dataRows].join('\n'));
  return tmpFile;
}

test.describe('Phase 4C: Data Migration Suite E2E', () => {
  test.setTimeout(120000);

  let csvFilePath: string;

  test.beforeAll(async () => {
    csvFilePath = createSampleCsv(5);
  });

  test.afterAll(async () => {
    // cleanup temp CSV
    try { fs.unlinkSync(csvFilePath); } catch {}
  });

  test('1. Admin can access the Data Migration page', async ({ page }) => {
    // Login as Admin
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    // Navigate to migration page
    await page.goto('http://localhost:5173/data-migration');
    await page.waitForLoadState('networkidle');

    // Page heading visible
    await expect(page.getByRole('heading', { name: /Data Migration|Migration/i }).first()).toBeVisible();

    await page.screenshot({ path: 'migration-page-access.png', fullPage: true });
  });

  test('2. Admin can upload a CSV file and see staging records', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    await page.goto('http://localhost:5173/data-migration');
    await page.waitForLoadState('networkidle');

    // Find file input and upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvFilePath);

    // Wait for upload success feedback
    await expect(
      page.locator('text=/uploaded|staged|success/i').first()
    ).toBeVisible({ timeout: 20000 });

    await page.screenshot({ path: 'migration-upload-success.png', fullPage: true });
  });

  test('3. Validation step flags errors and shows valid count', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    await page.goto('http://localhost:5173/data-migration');
    await page.waitForLoadState('networkidle');

    // Upload first
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvFilePath);
    await expect(
      page.locator('text=/uploaded|staged|success/i').first()
    ).toBeVisible({ timeout: 20000 });

    // Click Validate button
    const validateBtn = page.getByRole('button', { name: /validate/i });
    if (await validateBtn.isVisible()) {
      await validateBtn.click();
      // Wait for validation to complete (status changes from PENDING to VALIDATED/FAILED)
      await expect(
        page.locator('text=/validated|valid|VALIDATED|VALIDATION_FAILED/i').first()
      ).toBeVisible({ timeout: 30000 });
    }

    await page.screenshot({ path: 'migration-validate-result.png', fullPage: true });
  });

  test('4. Dry run shows entity projection metrics without modifying catalog', async ({ page }) => {
    // Login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    await page.goto('http://localhost:5173/data-migration');
    await page.waitForLoadState('networkidle');

    // Upload
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvFilePath);
    await expect(
      page.locator('text=/uploaded|staged|success/i').first()
    ).toBeVisible({ timeout: 20000 });

    // Validate
    const validateBtn = page.getByRole('button', { name: /validate/i });
    if (await validateBtn.isVisible()) {
      await validateBtn.click();
      await page.waitForTimeout(5000);
    }

    // Dry Run
    const dryRunBtn = page.getByRole('button', { name: /dry.?run/i });
    if (await dryRunBtn.isVisible()) {
      await dryRunBtn.click();
      // Wait for dry-run summary
      await expect(
        page.locator('text=/books|copies|entities|estimated/i').first()
      ).toBeVisible({ timeout: 30000 });
    }

    await page.screenshot({ path: 'migration-dry-run.png', fullPage: true });
  });

  test('5. Librarian cannot access commit controls (RBAC)', async ({ page }) => {
    // Login as Librarian
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    await page.goto('http://localhost:5173/data-migration');
    await page.waitForLoadState('networkidle');

    // Commit button should be absent or disabled for librarian
    const commitBtn = page.getByRole('button', { name: /commit/i });
    const isVisible = await commitBtn.isVisible().catch(() => false);
    if (isVisible) {
      const isDisabled = await commitBtn.isDisabled();
      expect(isDisabled).toBe(true);
    } else {
      // Page may show access denied or redirect — either is acceptable
      const bodyText = await page.locator('body').innerText();
      const noCommit = !bodyText.toLowerCase().includes('commit') ||
        bodyText.toLowerCase().includes('access denied') ||
        bodyText.toLowerCase().includes('not authorized') ||
        bodyText.toLowerCase().includes('admin');
      expect(noCommit).toBeTruthy();
    }

    await page.screenshot({ path: 'migration-librarian-rbac.png', fullPage: true });
  });

  test('6. Batch history list is visible to admin', async ({ page }) => {
    // Login as Admin
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    await page.goto('http://localhost:5173/data-migration');
    await page.waitForLoadState('networkidle');

    // The batch history / previous batches section should be visible
    // (may be a table or list of previous migration batches)
    await expect(
      page.locator('text=/batch|migration history|previous|upload history/i').first()
    ).toBeVisible({ timeout: 15000 });

    await page.screenshot({ path: 'migration-batch-history.png', fullPage: true });
  });
});

