import { test, expect } from '@playwright/test';

test.describe('RFID Middleware Connection, Backend Outage Handling & Auto-Reconnection', () => {
  test.setTimeout(60000);

  test.beforeEach(async ({ page }) => {
    // Navigate and login
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');
    await page.waitForLoadState('networkidle');
  });

  test('1. Online Detection — Dashboard displays RFID Middleware ONLINE with live payload', async ({
    page,
  }) => {
    // Intercept RFID health check to return nominal response
    await page.route('**/health', async (route) => {
      const url = route.request().url();
      if (url.includes(':8000') || url.includes('/rfid/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'HEALTHY',
            service: 'smartlib-rfid-middleware',
            version: '1.0.0-phase2b',
            mock_hardware: true,
            backend_connected: true,
            backend_url: 'http://localhost:5000/api/v1',
            buffer_path: './data/offline_events.db',
            pending_events: 0,
            devices_online: 3,
            uptime_seconds: 142.5,
            timestamp: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    const rfidBadge = page.locator('text=RFID Middleware').locator('..');
    await expect(rfidBadge).toBeVisible({ timeout: 10000 });
    await expect(rfidBadge.locator('text=Online')).toBeVisible({ timeout: 10000 });
  });

  test('2. Backend Outage Handling — RFID Middleware remains ONLINE in Buffered Mode when backend is down', async ({
    page,
  }) => {
    // Simulate backend outage: Express backend /health aborts
    await page.route('**/api/v1/health', (route) => route.abort('failed'));

    // RFID middleware returns healthy status but backend_connected: false (buffering events to SQLite)
    await page.route('**/health', async (route) => {
      const url = route.request().url();
      if (url.includes(':8000') || url.includes('/rfid/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'HEALTHY',
            service: 'smartlib-rfid-middleware',
            version: '1.0.0-phase2b',
            mock_hardware: true,
            backend_connected: false, // Outage detected by RFID middleware
            backend_url: 'http://localhost:5000/api/v1',
            buffer_path: './data/offline_events.db',
            pending_events: 4,
            devices_online: 3,
            uptime_seconds: 210.0,
            timestamp: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    const backendBadge = page.locator('text=Backend API').locator('..');
    const rfidBadge = page.locator('text=RFID Middleware').locator('..');

    // Backend API transitions to Offline
    await expect(backendBadge.locator('text=Offline')).toBeVisible({ timeout: 15000 });

    // RFID Middleware remains ONLINE and indicates Offline Buffer Active
    await expect(rfidBadge.locator('text=Online')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Offline Buffer Active')).toBeVisible({ timeout: 10000 });
  });

  test('3. Automatic Reconnection — RFID transitions to Offline when unreachable and reconnects automatically', async ({
    page,
  }) => {
    const rfidBadge = page.locator('text=RFID Middleware').locator('..');

    // 1. Initially online
    await page.route('**/health', async (route) => {
      const url = route.request().url();
      if (url.includes(':8000') || url.includes('/rfid/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'HEALTHY',
            service: 'smartlib-rfid-middleware',
            devices_online: 3,
            backend_connected: true,
          }),
        });
      } else {
        await route.continue();
      }
    });
    await expect(rfidBadge.locator('text=Online')).toBeVisible({ timeout: 10000 });

    // 2. Simulate RFID service stoppage: all RFID health routes fail
    await page.route('**/health', async (route) => {
      const url = route.request().url();
      if (url.includes(':8000') || url.includes('/rfid/')) {
        await route.abort('connectionrefused');
      } else {
        await route.continue();
      }
    });
    await expect(rfidBadge.locator('text=Offline')).toBeVisible({ timeout: 20000 });

    // 3. Simulate RFID service restart: RFID route fulfilled again
    await page.route('**/health', async (route) => {
      const url = route.request().url();
      if (url.includes(':8000') || url.includes('/rfid/')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            status: 'HEALTHY',
            service: 'smartlib-rfid-middleware',
            devices_online: 3,
            backend_connected: true,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Automatically recovers to Online
    await expect(rfidBadge.locator('text=Online')).toBeVisible({ timeout: 25000 });
  });

  test('4. Host Resolution Fallback — 127.0.0.1 fallback activates if localhost fails', async ({
    page,
  }) => {
    // If localhost:8000 fails (e.g. Windows IPv6 refusal), 127.0.0.1:8000 succeeds
    await page.route('http://localhost:8000/health', (route) => route.abort('connectionrefused'));
    await page.route('http://127.0.0.1:8000/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'HEALTHY',
          service: 'smartlib-rfid-middleware',
          devices_online: 3,
          backend_connected: true,
        }),
      });
    });

    const rfidBadge = page.locator('text=RFID Middleware').locator('..');
    await expect(rfidBadge.locator('text=Online')).toBeVisible({ timeout: 15000 });
  });
});
