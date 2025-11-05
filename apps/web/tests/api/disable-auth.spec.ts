import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

const API_BASE_URL = 'http://localhost:3001';

test.describe('DISABLE_AUTH Mode Tests', () => {
  test('protected endpoints work without authentication', async ({ request }) => {
    // Test tenant.get endpoint without any auth header
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`);

    // Should not return 401 Unauthorized
    expect(response.status()).not.toBe(401);

    // Will return 404 if tenant doesn't exist, which is expected
    const data = await response.json();
    if (response.status() === 404) {
      expect(data.error.json.data.code).toBe('NOT_FOUND');
      expect(data.error.json.message).toContain('Tenant not found');
    } else {
      // If tenant exists, should return tenant data
      expect(response.status()).toBe(200);
    }
  });

  test('can register new user without JWT', async ({ request }) => {
    const randomEmail = `test-${randomBytes(8).toString('hex')}@example.com`;
    const tenantName = `TestTenant-${randomBytes(4).toString('hex')}`;

    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email: randomEmail,
          password: 'SecurePass123!',
          name: 'Test User',
          tenantName: tenantName,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
  });

  test('public endpoints still work', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/trpc/auth.forgotPassword`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: { email: 'test@example.com' },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
  });
});

test.describe('Mock User Context', () => {
  test('mock user has OWNER role', async ({ request }) => {
    // The mock user should have OWNER role, so admin endpoints should work
    // We'll test this by trying to access a tenant endpoint
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`);

    // Should not get FORBIDDEN (403) error
    expect(response.status()).not.toBe(403);
  });

  test('mock user has tenantId set', async ({ request }) => {
    // Mock user has tenantId: 'test-tenant-id'
    // This should be used in tenant-scoped queries
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`);

    const data = await response.json();
    // If 404, it means the endpoint tried to find tenant with ID 'test-tenant-id'
    if (response.status() === 404) {
      expect(data.error.json.message).toContain('Tenant not found');
      // This is expected - mock tenant doesn't exist in DB
    }
  });
});
