import { test, expect, Page } from '@playwright/test';

// Set up mock network routes for deterministic frontend verification
async function setupMockApi(page: Page) {
  // Mock login endpoint
  await page.route('**/api/v1/auth/login', async (route) => {
    const postData = JSON.parse(route.request().postData() || '{}');
    const role = postData.email?.includes('librarian') ? 'LIBRARIAN' : 'ADMIN';
    const name = role === 'ADMIN' ? 'Institutional Administrator' : 'Chief Librarian';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: 'usr_mock_01',
            email: postData.email,
            name: name,
            firstName: name.split(' ')[0],
            lastName: name.split(' ')[1],
            role: role,
          },
          tokens: {
            accessToken: 'mock_jwt_token_header.mock_payload.mock_signature',
            refreshToken: 'mock_refresh_token',
          },
        },
      }),
    });
  });

  // Mock health check
  await page.route('**/api/v1/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        services: { database: 'connected' },
      }),
    });
  });

  // Mock RFID health
  await page.route('http://localhost:8000/health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'healthy', service: 'rfid-service' }),
    });
  });

  // Mock books
  await page.route('**/api/v1/books*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'book_01',
            title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
            author: 'Robert C. Martin',
            isbn: '9780132350884',
            category: { id: 'cat_01', name: 'Computer Science' },
            totalCopies: 2,
            availableCopies: 1,
            createdAt: '2026-11-06T00:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    });
  });

  // Mock members
  await page.route('**/api/v1/members*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'mem_01',
            membershipNumber: 'STD-2026-1001',
            name: 'Aarav Sharma',
            memberType: 'STUDENT',
            status: 'ACTIVE',
            department: 'Computer Science',
            currentLoans: 1,
            borrowingLimit: 3,
            createdAt: '2026-11-06T00:00:00Z',
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    });
  });

  // Mock circulation
  await page.route('**/api/v1/circulation*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'loan_01',
            memberId: 'mem_01',
            bookCopyId: 'copy_01',
            issuedAt: '2026-11-06T00:00:00Z',
            dueDate: '2026-11-20T00:00:00Z',
            status: 'ACTIVE',
            renewalCount: 0,
            bookCopy: {
              accessionNumber: 'ACC-2026-00001',
              book: { title: 'Clean Code' },
            },
            member: { name: 'Aarav Sharma', membershipNumber: 'STD-2026-1001' },
          },
        ],
        pagination: { page: 1, limit: 15, total: 1, totalPages: 1 },
      }),
    });
  });

  // Mock audit logs
  await page.route('**/api/v1/audit-logs*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            id: 'audit_01',
            action: 'LOGIN',
            entity: 'User',
            entityId: 'usr_mock_01',
            ipAddress: '127.0.0.1',
            createdAt: '2026-11-06T12:00:00Z',
            user: { name: 'Institutional Administrator', email: 'admin@smartlib.ac.in' },
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    });
  });

  // Mock RFID backend endpoints
  await page.route('**/api/v1/rfid/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
      }),
    });
  });

  // Mock RFID endpoints
  await page.route('http://localhost:8000/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/devices/status')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          devices: [
            { device_id: 'DEV-SS-001', device_type: 'staff_station', status: 'online', scan_count: 42 },
            { device_id: 'DEV-HH-001', device_type: 'handheld', status: 'online', scan_count: 128 },
            { device_id: 'DEV-SG-001', device_type: 'security_gate', status: 'online', scan_count: 512 },
          ],
          total_online: 3,
        }),
      });
    } else if (url.includes('/events')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          events: [
            {
              event_id: 'evt_01',
              timestamp: '2026-11-06T12:00:00Z',
              device_id: 'DEV-SG-001',
              epc: '3034257BF4000B4000000001',
              is_authorized: true,
              alarm_triggered: false,
              status: 'synced',
            },
          ],
          total: 1,
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', mock_emulator: true }),
      });
    }
  });
}

// Helper to authenticate
async function loginAsAdmin(page: Page) {
  await setupMockApi(page);
  await page.goto('/login');
  await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
  await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
}

test.describe('SmartLib End-to-End Frontend Verification', () => {
  test('1. Authentication Flow — Login and Logout', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/login');
    await expect(page.locator('text=Sign in to your account')).toBeVisible();

    await page.fill('input[type="email"]', 'admin@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Admin@SmartLib2026!');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/');
    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('header')).toContainText('Institutional Administrator');

    // Logout
    await page.click('button:has-text("Institutional Administrator")');
    await page.click('text=Sign out');
    await page.waitForURL('**/login');
    await expect(page.locator('text=Sign in to your account')).toBeVisible();
  });

  test('2. Unauthenticated Guard — Protected routes redirect to /login', async ({ page }) => {
    await page.goto('/books');
    await expect(page).toHaveURL(/.*login.*/);

    await page.goto('/circulation');
    await expect(page).toHaveURL(/.*login.*/);

    await page.goto('/audit');
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('3. Dashboard Inspection — Health Telemetry & KPI Cards', async ({ page }) => {
    await loginAsAdmin(page);

    await expect(page.locator('h1')).toHaveText('Dashboard');
    await expect(page.locator('text=Backend API')).toBeVisible();
    await expect(page.locator('text=RFID Middleware')).toBeVisible();
    await expect(page.locator('text=Total Books')).toBeVisible();
    await expect(page.locator('text=Active Members')).toBeVisible();
    await expect(page.locator('text=Active Loans')).toBeVisible();
    await expect(page.locator('text=Weekly Circulation')).toBeVisible();
    await expect(page.locator('text=RFID Event Activity')).toBeVisible();
  });

  test('4. All 17 Navigation Modules Exploration', async ({ page }) => {
    await loginAsAdmin(page);

    const routes = [
      { name: 'Book Catalog', path: '/books', header: 'Book Catalog' },
      { name: 'Cataloguing', path: '/cataloguing', header: 'Cataloguing & Accessioning' },
      { name: 'Members', path: '/members', header: 'Members' },
      { name: 'Circulation', path: '/circulation', header: 'Circulation' },
      { name: 'RFID Tagging', path: '/rfid/tagging', header: 'RFID Tagging & Encoding Station' },
      { name: 'RFID Devices', path: '/rfid/devices', header: 'RFID Hardware Fleet' },
      { name: 'Inventory Management', path: '/inventory', header: 'Inventory & Shelf Audit' },
      { name: 'Security Gate', path: '/security-gate', header: 'Security Gate Telemetry & EAS Monitor' },
      { name: 'Data Migration', path: '/migration', header: 'Data Migration & ILS Import' },
      { name: 'Reports & Analytics', path: '/reports', header: 'Reports & Institutional Analytics' },
      { name: 'Notifications', path: '/notifications', header: 'Notifications & Alerts' },
      { name: 'User Management', path: '/users', header: 'Staff & User Management' },
      { name: 'Roles & Permissions', path: '/roles', header: 'Roles & Access Control (RBAC)' },
      { name: 'Audit Logs', path: '/audit', header: 'Audit Trail & System Logs' },
      { name: 'System Settings', path: '/settings', header: 'System Settings' },
      { name: 'Backup & Updates', path: '/backup', header: 'Backup & Offline Synchronization' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.locator('h1')).toHaveText(route.header);
    }
  });

  test('5. Book Catalog Search & Table Listing', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/books');

    await expect(page.locator('h1')).toHaveText('Book Catalog');
    await expect(page.locator('input[placeholder*="Search title"]')).toBeVisible();
    await expect(page.locator('text=Clean Code')).toBeVisible();
    await expect(page.locator('text=Robert C. Martin')).toBeVisible();
  });

  test('6. Member Directory View', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/members');

    await expect(page.locator('h1')).toHaveText('Members');
    await expect(page.locator('text=Aarav Sharma')).toBeVisible();
    await expect(page.locator('text=STD-2026-1001')).toBeVisible();
  });

  test('7. Circulation Workflow Controls', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/circulation');

    await expect(page.locator('h1')).toHaveText('Circulation');
    await expect(page.locator('text=Issue Book (Check-Out)')).toBeVisible();
    await expect(page.locator('input[placeholder*="mem_student_01"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="copy_clean_code_01"]')).toBeVisible();
    await expect(page.locator('button:has-text("Confirm Issue")')).toBeVisible();
  });

  test('8. RFID Hardware Stations Telemetry', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/rfid/devices');
    await expect(page.locator('h1')).toHaveText('RFID Hardware Fleet');
    await expect(page.locator('text=DEV-SS-001')).toBeVisible();
    await expect(page.locator('text=DEV-HH-001')).toBeVisible();
    await expect(page.locator('text=DEV-SG-001')).toBeVisible();

    await page.goto('/security-gate');
    await expect(page.locator('h1')).toHaveText('Security Gate Telemetry & EAS Monitor');
    await expect(page.locator('button:has-text("Simulate Gate Crossing")')).toBeVisible();
  });

  test('9. RBAC Route Guard Enforcement', async ({ page }) => {
    await setupMockApi(page);
    await page.goto('/login');
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/');

    // Attempt direct access to Admin-only routes
    await page.goto('/audit');
    await expect(page).toHaveURL(/.*unauthorized.*/);
    await expect(page.locator('text=Access Denied')).toBeVisible();

    await page.goto('/users');
    await expect(page).toHaveURL(/.*unauthorized.*/);

    await page.goto('/backup');
    await expect(page).toHaveURL(/.*unauthorized.*/);
  });
});
