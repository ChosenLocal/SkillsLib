import { test, expect } from '@playwright/test';
import { testUsers } from '../fixtures/auth.fixture';

test.describe('Authentication', () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // No auth for these tests

  test('should show login page on root path', async ({ page }) => {
    await page.goto('/');

    // Check for login form elements
    await expect(page.locator('[name="email"]')).toBeVisible();
    await expect(page.locator('[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should successfully log in with valid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in login form
    await page.fill('[name="email"]', testUsers.tenant1.email);
    await page.fill('[name="password"]', testUsers.tenant1.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Verify dashboard is visible
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should show error message with invalid credentials', async ({ page }) => {
    await page.goto('/');

    // Fill in login form with wrong password
    await page.fill('[name="email"]', testUsers.tenant1.email);
    await page.fill('[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await expect(
      page.locator('text=/Invalid credentials|Invalid email or password/i')
    ).toBeVisible({ timeout: 5000 });

    // Should still be on login page
    await expect(page.url()).toContain('/');
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Try to access protected route
    await page.goto('/dashboard/projects');

    // Should redirect to login
    await page.waitForURL('/', { timeout: 10000 });

    // Verify login form is visible
    await expect(page.locator('[name="email"]')).toBeVisible();
  });

  test('should stay on dashboard after successful login', async ({ page }) => {
    await page.goto('/');

    // Login
    await page.fill('[name="email"]', testUsers.tenant1.email);
    await page.fill('[name="password"]', testUsers.tenant1.password);
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL('/dashboard', { timeout: 10000 });

    // Navigate to projects
    await page.goto('/dashboard/projects');

    // Should still be authenticated
    await expect(page.url()).toContain('/dashboard/projects');
    await expect(page.locator('text=Projects')).toBeVisible();
  });
});
