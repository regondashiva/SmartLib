import { test, expect } from '@playwright/test';

test.describe('Connection Reconnection & Fault Tolerance Verification', () => {
  test.setTimeout(60000);
  test('Dashboard transitions to Offline when backend unreachable and reconnects automatically', async ({
    page,
  }) => {
    // 1. Navigate and login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    // 2. Verify initially Online
    const backendBadge = page.locator('text=Backend API').locator('..');
    await expect(backendBadge.locator('text=Online')).toBeVisible({ timeout: 10000 });

    // 3. Simulate backend outage (network disconnect on /health)
    await page.route('**/api/v1/health', (route) => route.abort('failed'));
    await expect(backendBadge.locator('text=Offline')).toBeVisible({ timeout: 20000 });

    // 4. Simulate backend restart / recovery
    await page.unroute('**/api/v1/health');
    await expect(backendBadge.locator('text=Online')).toBeVisible({ timeout: 25000 });
  });

  test('Public health check works when user is logged out', async ({ page }) => {
    // Clear storage
    await page.goto('http://localhost:5173/login');
    await page.evaluate(() => localStorage.clear());

    // Health check endpoint still returns 200 without token
    const response = await page.request.get('http://localhost:5000/api/v1/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('HEALTHY');
  });

  test('Invalid JWT causes auth error without marking backend offline', async ({ page }) => {
    await page.goto('http://localhost:5173/login');
    // Set invalid token
    await page.evaluate(() => {
      localStorage.setItem('smartlib_token', 'invalid_expired_token_xyz');
      localStorage.setItem('smartlib_user', JSON.stringify({ id: '1', role: 'LIBRARIAN' }));
    });

    // Request protected endpoint
    const response = await page.request.get('http://localhost:5000/api/v1/members', {
      headers: { Authorization: 'Bearer invalid_expired_token_xyz' },
    });
    // Verifies 401 Unauthorized
    expect(response.status()).toBe(401);

    // But health endpoint remains 200 Healthy
    const healthRes = await page.request.get('http://localhost:5000/api/v1/health');
    expect(healthRes.status()).toBe(200);
  });
});
