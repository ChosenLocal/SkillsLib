import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

const API_BASE_URL = 'http://localhost:3001';

test.describe('Auth API - Registration', () => {
  test('register new user successfully', async ({ request }) => {
    const randomEmail = `test-${randomBytes(8).toString('hex')}@example.com`;
    const tenantName = `TestTenant-${randomBytes(4).toString('hex')}`;

    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: {
        'Content-Type': 'application/json',
      },
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
    expect(data.result).toBeDefined();
    expect(data.result.data).toBeDefined();
    expect(data.result.data.json.success).toBe(true);
    expect(data.result.data.json.message).toContain('Registration successful');
  });

  test('reject registration with existing email', async ({ request }) => {
    const email = `duplicate-${randomBytes(8).toString('hex')}@example.com`;
    const tenantName = `TestTenant-${randomBytes(4).toString('hex')}`;

    // First registration
    await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email,
          password: 'SecurePass123!',
          name: 'Test User',
          tenantName,
        },
      },
    });

    // Duplicate registration
    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email,
          password: 'SecurePass123!',
          name: 'Test User 2',
          tenantName: `${tenantName}-2`,
        },
      },
    });

    expect(response.status()).not.toBe(200);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('reject registration with weak password', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email: `test-${randomBytes(8).toString('hex')}@example.com`,
          password: 'weak', // Too short
          name: 'Test User',
          tenantName: `TestTenant-${randomBytes(4).toString('hex')}`,
        },
      },
    });

    expect(response.status()).not.toBe(200);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('reject registration with invalid email', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email: 'not-an-email',
          password: 'SecurePass123!',
          name: 'Test User',
          tenantName: `TestTenant-${randomBytes(4).toString('hex')}`,
        },
      },
    });

    expect(response.status()).not.toBe(200);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

test.describe('Auth API - Password Reset', () => {
  test('forgot password for existing user', async ({ request }) => {
    // First create a user
    const email = `reset-${randomBytes(8).toString('hex')}@example.com`;
    const tenantName = `TestTenant-${randomBytes(4).toString('hex')}`;

    await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email,
          password: 'SecurePass123!',
          name: 'Test User',
          tenantName,
        },
      },
    });

    // Request password reset
    const response = await request.post(`${API_BASE_URL}/trpc/auth.forgotPassword`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: { email },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
  });

  test('forgot password does not reveal if user exists', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/trpc/auth.forgotPassword`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: { email: 'nonexistent@example.com' },
      },
    });

    // Should return success even for non-existent users (security best practice)
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
  });
});

test.describe('tRPC Protocol', () => {
  test('tRPC returns proper error for missing procedure', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/trpc`);

    // Should return tRPC error (not HTML 404)
    expect(response.headers()['content-type']).toContain('application/json');
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.code).toBe(-32004); // NOT_FOUND procedure error
  });
});
