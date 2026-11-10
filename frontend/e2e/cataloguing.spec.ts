import { test, expect } from '@playwright/test';

test.describe('Phase 4A: Cataloguing & Book Creation End-to-End Suite', () => {
  test.setTimeout(60000);

  test('Librarian creates a new book in Cataloguing page and verifies persistence in Book Catalog', async ({
    page,
  }) => {
    const timestamp = Date.now().toString().slice(-7);
    const testTitle = `Modern Distributed Computing Vol. ${timestamp}`;
    const testIsbn = `978${Date.now().toString().slice(-10)}`;

    // 1. Login as Librarian
    await page.goto('http://localhost:5173/login');
    await page.fill('input[type="email"]', 'librarian@smartlib.ac.in');
    await page.fill('input[type="password"]', 'Lib@SmartLib2026!');
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    // 2. Navigate to Cataloguing
    await page.goto('http://localhost:5173/cataloguing');
    await page.waitForLoadState('networkidle');

    // Verify form elements exist
    await expect(page.getByRole('heading', { name: 'Bibliographic Record' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Physical Inventory & Copies' })).toBeVisible();

    // 3. Test validation: Submit empty form
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Book title is required.')).toBeVisible();

    // 4. Fill in valid book details
    await page.fill('input[placeholder*="Clean Code"]', testTitle);
    await page.fill('input[placeholder*="Elements of Reusable"]', 'Core Architecture Patterns');

    // First author
    await page.fill('input[placeholder*="Author 1"]', 'Martin Fowler');

    // Add a second author
    await page.click('text=Add Author');
    await page.fill('input[placeholder*="Author 2"]', 'Kent Beck');

    // ISBN & Classification
    await page.fill('input[placeholder="e.g. 9780132350884"]', testIsbn);
    await page.fill('input[placeholder="e.g. Prentice Hall"]', "O'Reilly Media");
    await page.fill('input[placeholder="e.g. 005.1"]', '005.74');
    await page.fill('input[placeholder*="QA76.76"]', 'QA76.9.D5 F69 2024');

    // Description
    await page.fill('textarea', 'Comprehensive guide to enterprise distributed computing and resilient design patterns.');

    // Copies count: 2
    await page.fill('input[type="number"][min="1"][max="50"]', '2');
    await page.fill('input[placeholder="e.g. STACK-A-01"]', 'STACK-DIST-01');

    // 5. Submit the form
    await page.click('button[type="submit"]');

    // 6. Verify success banner displays
    await expect(
      page.locator('text=Bibliographic Record Catalogued & 2 Physical Copies Provisioned')
    ).toBeVisible({ timeout: 25000 });
    await expect(page.getByText(testTitle).first()).toBeVisible();

    // Verify accession badges
    const accessionBadges = page.locator('span:has-text("ACC-")');
    await expect(accessionBadges.first()).toBeVisible();

    // 7. Click "View Catalog" or navigate to /books
    await page.click('text=View Catalog');
    await page.waitForURL('http://localhost:5173/books');
    await page.waitForLoadState('networkidle');

    // 8. Search for the newly created book
    await page.fill('input[placeholder*="Search title"]', testTitle);
    await page.click('button:has-text("Search")');

    // Verify the book is listed in the table
    await expect(page.locator(`text=${testTitle}`)).toBeVisible({ timeout: 15000 });

    // 9. Capture screenshot for verification evidence
    await page.screenshot({
      path: 'cataloguing-success-verified.png',
      fullPage: true,
    });
  });
});
