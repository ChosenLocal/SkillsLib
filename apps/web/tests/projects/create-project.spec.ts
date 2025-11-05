import { test, expect } from '@playwright/test';
import {
  cleanupTestData,
  getTenantBySlug,
  disconnectDatabase,
} from '../fixtures/database.fixture';

test.describe('Project Creation', () => {
  let tenantId: string;

  test.beforeAll(async () => {
    // Get tenant ID for cleanup
    const tenant = await getTenantBySlug('demo-contractor');
    tenantId = tenant!.id;
  });

  test.afterAll(async () => {
    // Clean up test data
    await cleanupTestData(tenantId);
    await disconnectDatabase();
  });

  test('should navigate to create project page', async ({ page }) => {
    await page.goto('/dashboard/projects');

    // Click "New Project" button
    await page.click('text=New Project');

    // Should navigate to new project page
    await page.waitForURL('/dashboard/projects/new', { timeout: 10000 });

    // Verify form is visible
    await expect(page.locator('text=Create New Project')).toBeVisible();
  });

  test('should create a new website project', async ({ page }) => {
    await page.goto('/dashboard/projects/new');

    // Fill in project form
    await page.selectOption('[name="type"]', 'website');
    await page.fill('[name="name"]', 'Test Website Project');
    await page.fill('[name="description"]', 'This is a test website project');
    await page.fill('[name="maxIterations"]', '3');

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Wait for redirect to project detail page
    await page.waitForURL(/\/dashboard\/projects\/[a-f0-9-]+$/, { timeout: 10000 });

    // Verify project header is visible
    await expect(page.locator('text=Test Website Project')).toBeVisible();
    await expect(page.locator('text=DRAFT')).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/dashboard/projects/new');

    // Try to submit without filling required fields
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Should show validation errors
    await expect(
      page.locator('text=/Please select a project type|Project type is required/i')
    ).toBeVisible();
    await expect(
      page.locator('text=/Project name is required|Please enter a project name/i')
    ).toBeVisible();
  });

  test('should validate project name length', async ({ page }) => {
    await page.goto('/dashboard/projects/new');

    // Fill with too long name (> 100 characters)
    await page.selectOption('[name="type"]', 'website');
    await page.fill(
      '[name="name"]',
      'A'.repeat(101) // 101 characters
    );

    // Submit form
    await page.click('button[type="submit"]:has-text("Create Project")');

    // Should show validation error
    await expect(
      page.locator('text=/Name must be|maximum of 100 characters/i')
    ).toBeVisible();
  });

  test('should create different project types', async ({ page }) => {
    const projectTypes = [
      { value: 'content', name: 'Test Content Project' },
      { value: 'seo_audit', name: 'Test SEO Audit Project' },
    ];

    for (const projectType of projectTypes) {
      await page.goto('/dashboard/projects/new');

      // Fill in form
      await page.selectOption('[name="type"]', projectType.value);
      await page.fill('[name="name"]', projectType.name);

      // Submit
      await page.click('button[type="submit"]:has-text("Create Project")');

      // Wait for redirect
      await page.waitForURL(/\/dashboard\/projects\/[a-f0-9-]+$/, { timeout: 10000 });

      // Verify project name
      await expect(page.locator(`text=${projectType.name}`)).toBeVisible();
    }
  });

  test('should show created project in projects list', async ({ page }) => {
    // Create a project
    await page.goto('/dashboard/projects/new');
    await page.selectOption('[name="type"]', 'website');
    await page.fill('[name="name"]', 'Project in List Test');
    await page.click('button[type="submit"]:has-text("Create Project")');
    await page.waitForURL(/\/dashboard\/projects\/[a-f0-9-]+$/, { timeout: 10000 });

    // Navigate back to projects list
    await page.goto('/dashboard/projects');

    // Verify project appears in list
    await expect(page.locator('text=Project in List Test')).toBeVisible();
  });
});
