import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Navigate to login page
  await page.goto('/');

  // Fill in login form
  await page.fill('[name="email"]', 'demo@contractor.com');
  await page.fill('[name="password"]', 'testpassword123');

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });

  // Verify we're logged in by checking for dashboard heading
  await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });

  // Save signed-in state
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication setup complete. Storage state saved to:', authFile);
});
