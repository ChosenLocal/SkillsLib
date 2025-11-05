import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  getTenantBySlug,
  createTestProject,
  disconnectDatabase,
} from '../fixtures/database.fixture';

test.describe('Project List and Filtering', () => {
  let tenantId: string;

  test.beforeAll(async () => {
    // Get tenant ID
    const tenant = await getTenantBySlug('demo-contractor');
    tenantId = tenant!.id;

    // Create test projects with different statuses and types
    await createTestProject(tenantId, {
      name: 'Draft Website Project',
      type: 'WEBSITE',
      status: 'DRAFT',
    });

    await createTestProject(tenantId, {
      name: 'In Progress Content Project',
      type: 'CONTENT',
      status: 'IN_PROGRESS',
    });

    await createTestProject(tenantId, {
      name: 'Completed SEO Audit',
      type: 'SEO_AUDIT',
      status: 'COMPLETED',
    });

    await createTestProject(tenantId, {
      name: 'Another Website Project',
      type: 'WEBSITE',
      status: 'IN_PROGRESS',
    });
  });

  test.afterAll(async () => {
    // Clean up test data
    await cleanupTestData(tenantId);
    await disconnectDatabase();
  });

  test('should display all projects by default', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Verify all test projects are visible
    await expect(page.locator('text=Draft Website Project')).toBeVisible();
    await expect(page.locator('text=In Progress Content Project')).toBeVisible();
    await expect(page.locator('text=Completed SEO Audit')).toBeVisible();
    await expect(page.locator('text=Another Website Project')).toBeVisible();
  });

  test('should filter projects by search term', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Enter search term
    await page.fill('[placeholder*="Search"], [name="search"]', 'website');

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Should show only projects with "website" in name
    await expect(page.locator('text=Draft Website Project')).toBeVisible();
    await expect(page.locator('text=Another Website Project')).toBeVisible();

    // Should NOT show other projects
    await expect(page.locator('text=In Progress Content Project')).not.toBeVisible();
    await expect(page.locator('text=Completed SEO Audit')).not.toBeVisible();
  });

  test('should filter projects by status', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Select status filter
    await page.selectOption('[name="status"], select:has-text("Status")', 'draft');

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Should show only draft projects
    await expect(page.locator('text=Draft Website Project')).toBeVisible();

    // Should NOT show other statuses
    await expect(page.locator('text=In Progress Content Project')).not.toBeVisible();
    await expect(page.locator('text=Completed SEO Audit')).not.toBeVisible();
  });

  test('should filter projects by type', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Select type filter
    await page.selectOption('[name="type"], select:has-text("Type")', 'website');

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Should show only website projects
    await expect(page.locator('text=Draft Website Project')).toBeVisible();
    await expect(page.locator('text=Another Website Project')).toBeVisible();

    // Should NOT show other types
    await expect(page.locator('text=In Progress Content Project')).not.toBeVisible();
    await expect(page.locator('text=Completed SEO Audit')).not.toBeVisible();
  });

  test('should combine multiple filters', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Apply multiple filters
    await page.selectOption('[name="type"], select:has-text("Type")', 'website');
    await page.selectOption('[name="status"], select:has-text("Status")', 'in_progress');

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Should show only in-progress website projects
    await expect(page.locator('text=Another Website Project')).toBeVisible();

    // Should NOT show other combinations
    await expect(page.locator('text=Draft Website Project')).not.toBeVisible();
    await expect(page.locator('text=In Progress Content Project')).not.toBeVisible();
    await expect(page.locator('text=Completed SEO Audit')).not.toBeVisible();
  });

  test('should show empty state when no projects match filters', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Search for non-existent project
    await page.fill('[placeholder*="Search"], [name="search"]', 'NonExistentProject12345');

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Should show empty state
    await expect(
      page.locator('text=/No projects found|No results|Nothing to show/i')
    ).toBeVisible();
  });

  test('should clear filters when clicking reset/clear button', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForSelector('text=Draft Website Project', { timeout: 10000 });

    // Apply filters
    await page.fill('[placeholder*="Search"], [name="search"]', 'website');
    await page.selectOption('[name="status"], select:has-text("Status")', 'draft');

    // Wait for filtering
    await page.waitForTimeout(1000);

    // Click clear/reset button if it exists
    const clearButton = page.locator('button:has-text("Clear"), button:has-text("Reset")');
    if (await clearButton.isVisible()) {
      await clearButton.click();

      // Wait for reset
      await page.waitForTimeout(1000);

      // All projects should be visible again
      await expect(page.locator('text=Draft Website Project')).toBeVisible();
      await expect(page.locator('text=In Progress Content Project')).toBeVisible();
      await expect(page.locator('text=Completed SEO Audit')).toBeVisible();
    }
  });
});
