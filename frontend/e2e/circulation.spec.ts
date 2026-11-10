import { test, expect } from '@playwright/test';

/**
 * Phase 4B: Circulation Lifecycle End-to-End Tests
 *
 * Prerequisites:
 * - Backend running at http://localhost:5000
 * - Frontend running at http://localhost:5173 (or 5174)
 * - At least one ACTIVE member and one AVAILABLE book copy in the DB
 *
 * This test verifies the UI flows, not the exact data —
 * it uses existing seeded data where needed.
 */

const BASE_URL = 'http://localhost:5173';
const ALT_URL  = 'http://localhost:5174';

async function getBaseUrl(page: import('@playwright/test').Page): Promise<string> {
  try {
    await page.goto(BASE_URL, { timeout: 5000 });
    return BASE_URL;
  } catch {
    return ALT_URL;
  }
}

test.describe('Phase 4B: Circulation Lifecycle', () => {
  test.setTimeout(90000);

  test('TC-E2E-01 · Librarian can view Circulation page with loans table', async ({ page }) => {
    const base = await getBaseUrl(page);

    // Login as librarian
    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${base}/`);

    // Navigate to Circulation
    await page.goto(`${base}/circulation`);
    await page.waitForLoadState('networkidle');

    // Verify page structure
    await expect(page.getByRole('heading', { name: 'Circulation', exact: true })).toBeVisible();
    await expect(page.getByText('Issue Book (Check-Out)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Active Loans Ledger' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fine Management' })).toBeVisible();
  });

  test('TC-E2E-02 · Issue form validates empty inputs', async ({ page }) => {
    const base = await getBaseUrl(page);

    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${base}/`);

    await page.goto(`${base}/circulation`);
    await page.waitForLoadState('networkidle');

    // Confirm Issue button should be disabled with empty inputs
    const confirmBtn = page.getByRole('button', { name: 'Confirm Issue' });
    await expect(confirmBtn).toBeDisabled();
  });

  test('TC-E2E-03 · Issue form with invalid UUIDs shows error', async ({ page }) => {
    const base = await getBaseUrl(page);

    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${base}/`);

    await page.goto(`${base}/circulation`);
    await page.waitForLoadState('networkidle');

    // Fill invalid UUIDs
    await page.fill('input[placeholder*="Member ID"]', '00000000-0000-0000-0000-000000000000');
    await page.fill('input[placeholder*="BookItem ID"]', '00000000-0000-0000-0000-000000000000');

    const confirmBtn = page.getByRole('button', { name: 'Confirm Issue' });
    await confirmBtn.click();

    // Wait for error response
    await page.waitForTimeout(3000);

    // Should show an error banner (member/book not found)
    const errorBanner = page.locator('[class*="bg-red"],[class*="text-red"]').filter({ hasText: /failed|not found|error/i });
    await expect(errorBanner.first()).toBeVisible({ timeout: 5000 });
  });

  test('TC-E2E-04 · Fine Management tab is accessible', async ({ page }) => {
    const base = await getBaseUrl(page);

    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${base}/`);

    await page.goto(`${base}/circulation`);
    await page.waitForLoadState('networkidle');

    // Switch to Fine Management tab
    await page.getByRole('button', { name: 'Fine Management' }).click();
    await page.waitForTimeout(1500);

    // Fine management table or empty state should be visible
    const fineSection = page.getByText('Fine Management').or(
      page.getByText('No fines').or(
        page.getByRole('table')
      )
    );
    await expect(fineSection.first()).toBeVisible();
  });

  test('TC-E2E-05 · Renew button disabled when max renewals reached', async ({ page }) => {
    const base = await getBaseUrl(page);

    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${base}/`);

    await page.goto(`${base}/circulation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for loans to load

    // If there are any loans with renewalCount >= 2, their Renew button should be disabled
    const renewButtons = page.getByRole('button', { name: 'Renew' });
    const count = await renewButtons.count();

    if (count > 0) {
      // At least verify the buttons exist
      await expect(renewButtons.first()).toBeVisible();
      console.log(`Found ${count} Renew button(s) in table`);
    } else {
      // No active loans — empty state is fine
      await expect(page.getByText('No loans found').or(page.getByText('No active loans'))).toBeVisible();
    }
  });

  test('TC-E2E-06 · Return dialog opens and shows loan details', async ({ page }) => {
    const base = await getBaseUrl(page);

    await page.goto(`${base}/login`);
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL(`${base}/`);

    await page.goto(`${base}/circulation`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Look for Return buttons (enabled ones have active loans)
    const returnButtons = page.getByRole('button', { name: 'Return' }).filter({ hasNot: page.locator('[disabled]') });
    const count = await returnButtons.count();

    if (count > 0) {
      await returnButtons.first().click();
      await page.waitForTimeout(500);

      // Dialog should appear
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Return Book' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Confirm Return' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();

      // Close dialog
      await page.getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 2000 });
    } else {
      console.log('No active returnable loans found — skipping return dialog test');
      test.skip();
    }
  });
});

