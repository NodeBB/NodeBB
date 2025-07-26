const { test, expect } = require('@playwright/test');

test.describe('Threading Admin Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'adminpass'); // Adjust as needed
    await page.click('button[type="submit"]');
    await page.waitForURL(/^((?!login).)*$/);
    
    // Navigate to admin panel
    await page.goto('/admin/settings/post');
  });

  test('should display threading settings section', async ({ page }) => {
    // Check for threading section
    const threadingSection = page.locator('#threading');
    await expect(threadingSection).toBeVisible();
    
    // Check section header
    const header = threadingSection.locator('h5');
    await expect(header).toContainText('Threading Settings');
  });

  test('should show all threading configuration options', async ({ page }) => {
    const threadingSection = page.locator('#threading');
    
    // Enable threading toggle
    const enableToggle = threadingSection.locator('#threadingEnabled');
    await expect(enableToggle).toBeVisible();
    
    // Max depth input
    const maxDepthInput = threadingSection.locator('#threadingMaxDepth');
    await expect(maxDepthInput).toBeVisible();
    await expect(maxDepthInput).toHaveAttribute('min', '1');
    await expect(maxDepthInput).toHaveAttribute('max', '10');
    
    // Default mode select
    const defaultModeSelect = threadingSection.locator('#threadingDefaultMode');
    await expect(defaultModeSelect).toBeVisible();
    const options = await defaultModeSelect.locator('option').count();
    expect(options).toBe(2); // flat and threaded
    
    // Allow migration toggle
    const migrationToggle = threadingSection.locator('#threadingAllowMigration');
    await expect(migrationToggle).toBeVisible();
  });

  test('should save threading settings', async ({ page }) => {
    const threadingSection = page.locator('#threading');
    
    // Enable threading
    await threadingSection.locator('#threadingEnabled').check();
    
    // Set max depth
    await threadingSection.locator('#threadingMaxDepth').fill('7');
    
    // Set default mode to threaded
    await threadingSection.locator('#threadingDefaultMode').selectOption('threaded');
    
    // Enable migration
    await threadingSection.locator('#threadingAllowMigration').check();
    
    // Save settings
    await page.click('button[data-action="save"]');
    
    // Wait for save confirmation
    await page.waitForSelector('.alert-success');
    const alert = page.locator('.alert-success');
    await expect(alert).toContainText(/saved/i);
    
    // Reload page and verify settings persisted
    await page.reload();
    
    await expect(threadingSection.locator('#threadingEnabled')).toBeChecked();
    await expect(threadingSection.locator('#threadingMaxDepth')).toHaveValue('7');
    await expect(threadingSection.locator('#threadingDefaultMode')).toHaveValue('threaded');
    await expect(threadingSection.locator('#threadingAllowMigration')).toBeChecked();
  });

  test('should validate max depth input', async ({ page }) => {
    const maxDepthInput = page.locator('#threadingMaxDepth');
    
    // Try to set invalid values
    await maxDepthInput.fill('0');
    await page.click('button[data-action="save"]');
    
    // Should show validation error or reset to min
    const value = await maxDepthInput.inputValue();
    expect(parseInt(value)).toBeGreaterThanOrEqual(1);
    
    // Try to set too high value
    await maxDepthInput.fill('15');
    await page.click('button[data-action="save"]');
    
    // Should show validation error or reset to max
    const value2 = await maxDepthInput.inputValue();
    expect(parseInt(value2)).toBeLessThanOrEqual(10);
  });

  test('should update table of contents', async ({ page }) => {
    // Check if threading appears in TOC
    const toc = page.locator('[component="settings/toc/list"]');
    const threadingLink = toc.locator('a[href="#threading"]');
    
    await expect(threadingLink).toBeVisible();
    await expect(threadingLink).toContainText('Threading Settings');
    
    // Click TOC link
    await threadingLink.click();
    
    // Should scroll to threading section
    await expect(page.locator('#threading')).toBeInViewport();
  });

  test('should apply settings to new topics', async ({ page, browser }) => {
    // Enable threading and set to threaded by default
    await page.locator('#threadingEnabled').check();
    await page.locator('#threadingDefaultMode').selectOption('threaded');
    await page.click('button[data-action="save"]');
    await page.waitForSelector('.alert-success');
    
    // Open new context as regular user
    const context = await browser.newContext();
    const userPage = await context.newPage();
    
    // Login as regular user
    await userPage.goto('/login');
    await userPage.fill('input[name="username"]', 'testuser');
    await userPage.fill('input[name="password"]', 'testpass');
    await userPage.click('button[type="submit"]');
    
    // Create new topic
    await userPage.goto('/category/1');
    await userPage.click('button[component="category/post"]');
    await userPage.fill('input[placeholder="Enter your topic title here..."]', 'Test Default Threading');
    await userPage.fill('.composer textarea', 'Testing default thread mode');
    await userPage.click('button[component="composer/submit"]');
    
    // New topic should default to threaded view
    await userPage.waitForURL(/\/topic\/\d+/);
    const toggleButton = userPage.locator('[data-action="toggle-threading"]');
    await expect(toggleButton).toHaveClass(/active/);
    
    await context.close();
  });
});