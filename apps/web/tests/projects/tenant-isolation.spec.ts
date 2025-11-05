import { test, expect, type Page } from '@playwright/test';
import {
  cleanupTestData,
  getTenantBySlug,
  createTestProject,
  disconnectDatabase,
} from '../fixtures/database.fixture';
import { testUsers, login } from '../fixtures/auth.fixture';

test.describe('Tenant Isolation', () => {
  let tenant1Id: string;
  let tenant2Id: string;
  let tenant1ProjectId: string;

  test.beforeAll(async () => {
    // Get both tenant IDs
    const tenant1 = await getTenantBySlug('demo-contractor');
    const tenant2 = await getTenantBySlug('test-tenant-2');
    tenant1Id = tenant1!.id;
    tenant2Id = tenant2!.id;

    // Create a project for tenant 1
    const project = await createTestProject(tenant1Id, {
      name: 'Tenant 1 Private Project',
      type: 'WEBSITE',
      status: 'DRAFT',
      description: 'This project should only be visible to Tenant 1',
    });
    tenant1ProjectId = project.id;

    // Create a project for tenant 2
    await createTestProject(tenant2Id, {
      name: 'Tenant 2 Private Project',
      type: 'CONTENT',
      status: 'IN_PROGRESS',
      description: 'This project should only be visible to Tenant 2',
    });
  });

  test.afterAll(async () => {
    // Clean up both tenants
    await cleanupTestData(tenant1Id);
    await cleanupTestData(tenant2Id);
    await disconnectDatabase();
  });

  test('tenant 1 user should only see tenant 1 projects', async ({ page }) => {
    // Login as tenant 1 user (using pre-authenticated storage state)
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForTimeout(2000);

    // Should see tenant 1 project
    await expect(page.locator('text=Tenant 1 Private Project')).toBeVisible();

    // Should NOT see tenant 2 project
    await expect(page.locator('text=Tenant 2 Private Project')).not.toBeVisible();
  });

  test('tenant 2 user should only see tenant 2 projects', async ({ page }) => {
    // Logout and login as tenant 2 user
    test.use({ storageState: { cookies: [], origins: [] } });

    await login(page, testUsers.tenant2.email, testUsers.tenant2.password);

    // Navigate to projects
    await page.goto('/dashboard/projects');

    // Wait for projects to load
    await page.waitForTimeout(2000);

    // Should see tenant 2 project
    await expect(page.locator('text=Tenant 2 Private Project')).toBeVisible();

    // Should NOT see tenant 1 project
    await expect(page.locator('text=Tenant 1 Private Project')).not.toBeVisible();
  });

  test('tenant 2 user cannot access tenant 1 project by direct URL', async ({ page }) => {
    // Login as tenant 2 user
    test.use({ storageState: { cookies: [], origins: [] } });

    await login(page, testUsers.tenant2.email, testUsers.tenant2.password);

    // Try to access tenant 1's project directly
    await page.goto(`/dashboard/projects/${tenant1ProjectId}`);

    // Should show error (404 or access denied)
    const hasError = await Promise.race([
      page.locator('text=/Not found|404|Access denied|Unauthorized/i').isVisible(),
      page.waitForTimeout(3000).then(() => false),
    ]);

    if (!hasError) {
      // If no error message, should be redirected away from the project
      const url = page.url();
      expect(url).not.toContain(tenant1ProjectId);
    } else {
      expect(hasError).toBe(true);
    }
  });

  test('tenant 1 user cannot see tenant 2 projects via API', async ({ page }) => {
    // Login as tenant 1 user (using pre-authenticated storage state)
    await page.goto('/dashboard/projects');

    // Intercept tRPC API calls
    const apiResponses: any[] = [];
    page.on('response', async (response) => {
      if (response.url().includes('/api/trpc/project.list')) {
        try {
          const json = await response.json();
          apiResponses.push(json);
        } catch (e) {
          // Ignore parse errors
        }
      }
    });

    // Reload to trigger API call
    await page.reload();
    await page.waitForTimeout(2000);

    // Check API responses
    if (apiResponses.length > 0) {
      const projectsData = apiResponses[0];

      // Ensure no tenant 2 projects in response
      const projects = projectsData?.result?.data?.items || [];
      const hasTenant2Project = projects.some((p: any) =>
        p.name?.includes('Tenant 2 Private Project')
      );

      expect(hasTenant2Project).toBe(false);
    }
  });

  test('search across tenants should not leak data', async ({ page }) => {
    // Login as tenant 1 user
    await page.goto('/dashboard/projects');

    // Search for tenant 2's project name
    await page.fill('[placeholder*="Search"], [name="search"]', 'Tenant 2');

    // Wait for search
    await page.waitForTimeout(1000);

    // Should NOT find tenant 2's project
    await expect(page.locator('text=Tenant 2 Private Project')).not.toBeVisible();

    // Should show "no results" or nothing
    const hasResults = await page.locator('[data-testid="project-card"]').count();
    expect(hasResults).toBe(0);
  });

  test('tenant isolation persists across navigation', async ({ page }) => {
    // Login as tenant 1 user
    await page.goto('/dashboard');

    // Navigate to different pages
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(1000);

    // Verify still only see tenant 1 data
    await expect(page.locator('text=Tenant 1 Private Project')).toBeVisible();
    await expect(page.locator('text=Tenant 2 Private Project')).not.toBeVisible();

    // Navigate to create page and back
    await page.goto('/dashboard/projects/new');
    await page.goto('/dashboard/projects');
    await page.waitForTimeout(1000);

    // Verify isolation still intact
    await expect(page.locator('text=Tenant 1 Private Project')).toBeVisible();
    await expect(page.locator('text=Tenant 2 Private Project')).not.toBeVisible();
  });
});
