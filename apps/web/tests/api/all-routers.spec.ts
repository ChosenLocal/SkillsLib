import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3001';

test.describe('All 7 tRPC Routers - Accessibility Test', () => {
  test('1. auth router - public endpoints work', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/trpc/auth.forgotPassword`, {
      headers: { 'Content-Type': 'application/json' },
      data: { json: { email: 'test@example.com' } },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
  });

  test('2. project router - protected endpoints accessible without JWT', async ({ request }) => {
    // List projects - should work with DISABLE_AUTH
    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`
    );

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);

    // Should return 200 with empty array (no projects for mock tenant)
    if (response.status() === 200) {
      const data = await response.json();
      expect(data.result.data.json.items).toBeDefined();
    }
  });

  test('3. tenant router - protected endpoints accessible without JWT', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`);

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);

    // Will return 404 if tenant doesn't exist, which is expected
    const data = await response.json();
    if (response.status() === 404) {
      expect(data.error.json.data.code).toBe('NOT_FOUND');
    }
  });

  test('4. companyProfile router - protected endpoints accessible', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/trpc/companyProfile.list?input=${encodeURIComponent('{"json":{}}')}`
    );

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);
  });

  test('5. subscription router - protected endpoints accessible', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/trpc/subscription.getCurrent`);

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);
  });

  test('6. workflow router - protected endpoints accessible', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/trpc/workflow.list?input=${encodeURIComponent('{"json":{}}')}`
    );

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);
  });

  test('7. agent router - protected endpoints accessible', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/trpc/agent.listExecutions?input=${encodeURIComponent('{"json":{}}')}`
    );

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);
  });
});

test.describe('Verification: Auth is truly bypassed', () => {
  test('no authorization header required for protected routes', async ({ request }) => {
    // Send request to protected endpoint WITHOUT any auth header
    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`
    );

    // Should work (not 401)
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });

  test('mock user context is applied automatically', async ({ request }) => {
    // The mock user should have OWNER role
    // Test that we can access admin-level endpoints
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`);

    // Should not get FORBIDDEN (would happen if role was wrong)
    expect(response.status()).not.toBe(403);
  });
});
