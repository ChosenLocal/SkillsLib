// packages/agents/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/__tests__/**/*.test.ts'],
    exclude: ['**/__tests__/.test-output/**', '**/__tests__/fixtures/**', 'node_modules/**'],
    testTimeout: 30000, // 30 seconds for E2E tests
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        '**/__tests__/**',
        '**/dist/**',
        '**/*.config.ts',
      ],
    },
  },
});
