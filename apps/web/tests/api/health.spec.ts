import { test, expect } from '@playwright/test';

const API_BASE_URL = 'http://localhost:3001';

test.describe('API Health Checks', () => {
  test('health endpoint returns ok with database connection', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');
    expect(data.version).toBeDefined();
  });

  test('health endpoint returns valid JSON', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const contentType = response.headers()['content-type'];

    expect(contentType).toContain('application/json');
  });

  test('health endpoint responds quickly', async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${API_BASE_URL}/health`);
    const responseTime = Date.now() - startTime;

    // Should respond within 1 second
    expect(responseTime).toBeLessThan(1000);
  });
});

test.describe('API Availability', () => {
  test('API server is accessible', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    expect(response.ok()).toBeTruthy();
  });

  test('CORS headers are present', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const headers = response.headers();

    // Check for CORS headers
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('tRPC endpoint exists and returns proper error for invalid requests', async ({ request }) => {
    // tRPC endpoint should be accessible and return proper tRPC error format
    const response = await request.get(`${API_BASE_URL}/trpc`);

    // Should return JSON response (not HTML 404 page)
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');

    // Should return tRPC error format
    const data = await response.json();
    expect(data.error).toBeDefined();
    expect(data.error.json).toBeDefined();
  });
});
