import { test, expect } from '@playwright/test';

test.describe('Dashboard Connection Status & Live KPI Verification', () => {
  test('Dashboard displays Backend API ONLINE, RFID ONLINE, and live Neon KPI metrics', async ({
    page,
  }) => {
    // 1. Navigate to login
    await page.goto('http://localhost:5173/login');
    await page.waitForLoadState('networkidle');

    // 2. Perform authentication as Librarian
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');

    // 3. Wait for navigation to dashboard
    await page.waitForURL('http://localhost:5173/', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // 4. Verify Connection Indicators in the header
    const backendIndicator = page.locator('text=Backend API').locator('..');
    await expect(backendIndicator).toBeVisible({ timeout: 10000 });
    await expect(backendIndicator.locator('text=Online')).toBeVisible();

    const rfidIndicator = page.locator('text=RFID Middleware').locator('..');
    await expect(rfidIndicator).toBeVisible();
    await expect(rfidIndicator.locator('text=Online')).toBeVisible();

    // Verify Neon DB badge is present
    await expect(page.locator('text=Neon DB')).toBeVisible();

    // 5. Verify KPI values are populated with live database data (NOT 0 and NOT —)
    // Total Books
    const booksCard = page.locator('text=Total Books').locator('..');
    await expect(booksCard).toBeVisible();
    await expect(booksCard.locator('p.text-2xl')).toHaveText('1');

    // Active Members
    const membersCard = page.locator('text=Active Members').locator('..');
    await expect(membersCard).toBeVisible();
    await expect(membersCard.locator('p.text-2xl')).toHaveText('1');

    // Active Loans
    const loansCard = page.locator('text=Active Loans').locator('..');
    await expect(loansCard).toBeVisible();
    await expect(loansCard.locator('p.text-2xl')).toHaveText('1');

    // RFID Tagged
    const rfidCard = page.locator('text=RFID Tagged').locator('..');
    await expect(rfidCard).toBeVisible();
    await expect(rfidCard.locator('p.text-2xl')).toHaveText('2');

    // Overdue Loans
    const overdueCard = page.locator('text=Overdue Loans').locator('..');
    await expect(overdueCard).toBeVisible();
    await expect(overdueCard.locator('p.text-2xl')).toHaveText('0');

    // Pending Fines
    const finesCard = page.locator('text=Pending Fines').locator('..');
    await expect(finesCard).toBeVisible();
    await expect(finesCard.locator('p.text-2xl')).toHaveText('₹ 0.00');

    // 6. Capture screenshot for verification evidence
    await page.screenshot({
      path: 'dashboard-online-verified.png',
      fullPage: true,
    });
  });
});

