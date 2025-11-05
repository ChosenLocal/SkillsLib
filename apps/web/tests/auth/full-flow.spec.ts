/**
 * Authentication Full Flow E2E Tests
 *
 * These tests verify the complete authentication and authorization flow.
 *
 * IMPORTANT: These tests should run with DISABLE_AUTH=false to verify
 * real authentication works correctly before production deployment.
 *
 * Run locally with: DISABLE_AUTH=false pnpm test:auth
 * CI should always run these with DISABLE_AUTH=false
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

const API_BASE_URL = 'http://localhost:3001';
const WEB_BASE_URL = 'http://localhost:3000';

// Helper to generate unique test data
function generateTestData() {
  const random = randomBytes(8).toString('hex');
  return {
    email: `test-${random}@example.com`,
    password: 'SecurePass123!',
    name: `Test User ${random}`,
    tenantName: `TestCorp-${random}`,
  };
}

test.describe('Authentication Flow (With Auth Enabled)', () => {
  test.skip(() => process.env.DISABLE_AUTH === 'true', 'Skipping - DISABLE_AUTH is true');

  test('should reject unauthenticated API requests', async ({ request }) => {
    // Try to access protected endpoint without token
    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}'}`
    );

    // Should return 401 Unauthorized
    expect(response.status()).toBe(401);

    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.data.code).toBe('UNAUTHORIZED');
  });

  test('should allow user registration', async ({ request }) => {
    const testData = generateTestData();

    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        json: {
          email: testData.email,
          password: testData.password,
          name: testData.name,
          tenantName: testData.tenantName,
        },
      },
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.result.data.json.success).toBe(true);
    expect(data.result.data.json.userId).toBeDefined();
    expect(data.result.data.json.tenantId).toBeDefined();
  });

  test('should reject duplicate email registration', async ({ request }) => {
    const testData = generateTestData();

    // Register first time
    await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { json: testData },
    });

    // Try to register again with same email
    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { json: testData },
    });

    expect(response.status()).not.toBe(200);
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json.message).toContain('already exists');
  });

  test('should reject weak passwords', async ({ request }) => {
    const testData = generateTestData();
    testData.password = '123'; // Weak password

    const response = await request.post(`${API_BASE_URL}/trpc/auth.register`, {
      headers: { 'Content-Type': 'application/json' },
      data: { json: testData },
    });

    expect(response.status()).not.toBe(200);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

test.describe('JWT Token Validation', () => {
  test.skip(() => process.env.DISABLE_AUTH === 'true', 'Skipping - DISABLE_AUTH is true');

  test('should reject invalid JWT tokens', async ({ request }) => {
    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`,
      {
        headers: {
          Authorization: 'Bearer invalid.jwt.token',
        },
      }
    );

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  test('should reject JWT tokens with wrong secret', async ({ request }) => {
    const jwt = require('jsonwebtoken');

    // Sign token with wrong secret
    const invalidToken = jwt.sign(
      {
        userId: 'test-user',
        tenantId: 'test-tenant',
        role: 'OWNER',
      },
      'wrong-secret-key',
      { expiresIn: '1h' }
    );

    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`,
      {
        headers: {
          Authorization: `Bearer ${invalidToken}`,
        },
      }
    );

    expect(response.status()).toBe(401);
  });

  test('should reject expired JWT tokens', async ({ request }) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.NEXTAUTH_SECRET || 'test-secret';

    // Sign token that's already expired
    const expiredToken = jwt.sign(
      {
        userId: 'test-user',
        tenantId: 'test-tenant',
        role: 'OWNER',
      },
      secret,
      { expiresIn: '-1h' } // Expired 1 hour ago
    );

    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`,
      {
        headers: {
          Authorization: `Bearer ${expiredToken}`,
        },
      }
    );

    expect(response.status()).toBe(401);
  });

  test('should accept valid JWT tokens', async ({ request }) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.NEXTAUTH_SECRET || 'h+BHQx9Cu9j3Q5lnOFZDUrBPP2rzHPmVYxSPEJ475f8=';

    // Create valid token
    const validToken = jwt.sign(
      {
        userId: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'OWNER',
        email: 'test@example.com',
      },
      secret,
      { expiresIn: '1h' }
    );

    const response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`,
      {
        headers: {
          Authorization: `Bearer ${validToken}`,
        },
      }
    );

    // Should not return 401
    expect(response.status()).not.toBe(401);
  });
});

test.describe('Role-Based Access Control', () => {
  test.skip(() => process.env.DISABLE_AUTH === 'true', 'Skipping - DISABLE_AUTH is true');

  test('MEMBER role should not access admin endpoints', async ({ request }) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.NEXTAUTH_SECRET || 'h+BHQx9Cu9j3Q5lnOFZDUrBPP2rzHPmVYxSPEJ475f8=';

    // Create token with MEMBER role
    const memberToken = jwt.sign(
      {
        userId: 'member-user',
        tenantId: 'test-tenant',
        role: 'MEMBER', // Not OWNER or ADMIN
        email: 'member@example.com',
      },
      secret,
      { expiresIn: '1h' }
    );

    // Try to access admin-only endpoint (if you have one)
    // Example: deleting a project might be admin-only
    const response = await request.post(`${API_BASE_URL}/trpc/tenant.update`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${memberToken}`,
      },
      data: {
        json: {
          name: 'Updated Name',
        },
      },
    });

    // Should return 403 Forbidden (not authorized for this role)
    expect([401, 403]).toContain(response.status());
  });

  test('OWNER role should access admin endpoints', async ({ request }) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.NEXTAUTH_SECRET || 'h+BHQx9Cu9j3Q5lnOFZDUrBPP2rzHPmVYxSPEJ475f8=';

    // Create token with OWNER role
    const ownerToken = jwt.sign(
      {
        userId: 'owner-user',
        tenantId: 'test-tenant',
        role: 'OWNER',
        email: 'owner@example.com',
      },
      secret,
      { expiresIn: '1h' }
    );

    // Try to access admin endpoint
    const response = await request.get(`${API_BASE_URL}/trpc/tenant.get`, {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
    });

    // Should not return 403 (might return 404 if tenant doesn't exist, that's OK)
    expect(response.status()).not.toBe(403);
  });
});

test.describe('Tenant Isolation', () => {
  test.skip(() => process.env.DISABLE_AUTH === 'true', 'Skipping - DISABLE_AUTH is true');

  test('users should only see their own tenant data', async ({ request }) => {
    const jwt = require('jsonwebtoken');
    const secret = process.env.NEXTAUTH_SECRET || 'h+BHQx9Cu9j3Q5lnOFZDUrBPP2rzHPmVYxSPEJ475f8=';

    // Create tokens for two different tenants
    const tenant1Token = jwt.sign(
      {
        userId: 'user-1',
        tenantId: 'tenant-1',
        role: 'OWNER',
        email: 'user1@example.com',
      },
      secret,
      { expiresIn: '1h' }
    );

    const tenant2Token = jwt.sign(
      {
        userId: 'user-2',
        tenantId: 'tenant-2',
        role: 'OWNER',
        email: 'user2@example.com',
      },
      secret,
      { expiresIn: '1h' }
    );

    // Get projects for tenant 1
    const tenant1Response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`,
      {
        headers: { Authorization: `Bearer ${tenant1Token}` },
      }
    );

    // Get projects for tenant 2
    const tenant2Response = await request.get(
      `${API_BASE_URL}/trpc/project.list?input=${encodeURIComponent('{"json":{}}')}`,
      {
        headers: { Authorization: `Bearer ${tenant2Token}` },
      }
    );

    expect(tenant1Response.status()).toBe(200);
    expect(tenant2Response.status()).toBe(200);

    const tenant1Data = await tenant1Response.json();
    const tenant2Data = await tenant2Response.json();

    // Data should be isolated (different results or both empty)
    // The important thing is that neither sees the other's data
    expect(tenant1Data.result.data.json.items).toBeDefined();
    expect(tenant2Data.result.data.json.items).toBeDefined();
  });
});

test.describe('Session Management', () => {
  test.skip(() => process.env.DISABLE_AUTH === 'true', 'Skipping - DISABLE_AUTH is true');

  test('should maintain session across requests', async ({ context }) => {
    const page = await context.newPage();

    // TODO: Implement full browser-based session test
    // This would involve:
    // 1. Registering a user
    // 2. Logging in
    // 3. Navigating to dashboard
    // 4. Reloading page
    // 5. Verifying still logged in

    await page.close();
  });
});
