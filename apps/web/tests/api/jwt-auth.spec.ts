import { test, expect } from '@playwright/test';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const API_BASE_URL = 'http://localhost:3001';
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'your-secret-here';

test.describe('JWT Authentication', () => {
  test('valid JWT token is processed by middleware', async ({ request }) => {
    // Create a valid JWT token
    const token = jwt.sign(
      {
        userId: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Try to access a protected endpoint
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // Should not return authentication error (401/403)
    // Might return 404/400 if tenant doesn't exist, but that's after auth
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });

  test('missing JWT token returns UNAUTHORIZED error', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`);

    // Should return UNAUTHORIZED error
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });

  test('invalid JWT token is rejected', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': 'Bearer invalid-token-here',
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });

  test('expired JWT token is rejected', async ({ request }) => {
    // Create an expired token
    const token = jwt.sign(
      {
        userId: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      JWT_SECRET,
      { expiresIn: '-1h' } // Already expired
    );

    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });

  test('JWT with wrong secret is rejected', async ({ request }) => {
    const token = jwt.sign(
      {
        userId: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      'wrong-secret-key',
      { expiresIn: '1h' }
    );

    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });
});

test.describe('JWT Payload Validation', () => {
  test('JWT missing required userId is rejected', async ({ request }) => {
    // Create token without userId
    const token = jwt.sign(
      {
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });
});

test.describe('Authorization Header Format', () => {
  test('Bearer token with correct format is processed', async ({ request }) => {
    const token = jwt.sign(
      {
        userId: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // Should not fail auth (401/403)
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
  });

  test('token without Bearer prefix is rejected', async ({ request }) => {
    const token = jwt.sign(
      {
        userId: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        'Authorization': token, // Missing "Bearer " prefix
      },
    });

    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });
});
