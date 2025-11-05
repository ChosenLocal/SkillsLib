import { test as base, expect, type Page } from '@playwright/test';

/**
 * Login helper
 */
export async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.fill('[name="email"]', email);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('/dashboard', { timeout: 10000 });
  await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
}

/**
 * Logout helper
 */
export async function logout(page: Page) {
  // Click user menu
  await page.click('[aria-label="User menu"], [data-testid="user-menu"]');

  // Click logout button
  await page.click('text=Logout');

  // Wait for redirect to login page
  await page.waitForURL('/', { timeout: 10000 });
}

/**
 * Test users
 */
export const testUsers = {
  tenant1: {
    email: 'demo@contractor.com',
    password: 'testpassword123',
    name: 'Demo User',
    role: 'OWNER',
  },
  tenant2: {
    email: 'user2@tenant2.com',
    password: 'testpassword123',
    name: 'Tenant 2 User',
    role: 'OWNER',
  },
};

/**
 * Extended test with auth helpers
 */
export const test = base.extend({
  testUsers: async ({}, use) => {
    await use(testUsers);
  },
});

export { expect };
