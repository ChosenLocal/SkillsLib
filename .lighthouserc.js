/**
 * Lighthouse CI Configuration
 *
 * Enforces quality thresholds for:
 * - Performance ≥ 90
 * - Accessibility ≥ 95
 * - Best Practices ≥ 90
 * - SEO ≥ 95
 * - Bundle size limits
 */

module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000/',
        'http://localhost:3000/dashboard',
        'http://localhost:3000/dashboard/projects',
      ],
      // Number of runs per URL
      numberOfRuns: 3,
      // Start server command
      startServerCommand: 'pnpm --filter=@business-automation/web build && pnpm --filter=@business-automation/web start',
      startServerReadyPattern: 'ready on',
      startServerReadyTimeout: 60000,
      // Settings
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
        },
        screenEmulation: {
          mobile: false,
          width: 1920,
          height: 1080,
          deviceScaleFactor: 1,
        },
      },
    },
    assert: {
      preset: 'lighthouse:recommended',
      assertions: {
        // Performance thresholds
        'categories:performance': ['error', { minScore: 0.9 }],
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        'speed-index': ['error', { maxNumericValue: 3000 }],

        // Accessibility thresholds
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'color-contrast': 'error',
        'document-title': 'error',
        'html-has-lang': 'error',
        'meta-viewport': 'error',
        'aria-allowed-attr': 'error',
        'aria-required-attr': 'error',
        'aria-valid-attr': 'error',
        'button-name': 'error',
        'image-alt': 'error',
        'label': 'error',
        'link-name': 'error',

        // Best Practices thresholds
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'errors-in-console': ['warn', { maxLength: 0 }],
        'no-vulnerable-libraries': 'error',
        'uses-http2': 'warn',
        'uses-passive-event-listeners': 'warn',

        // SEO thresholds
        'categories:seo': ['error', { minScore: 0.95 }],
        'meta-description': 'error',
        'robots-txt': 'warn',
        'hreflang': 'warn',
        'canonical': 'warn',

        // Resource size budgets
        'resource-summary:script:size': ['error', { maxNumericValue: 512000 }], // 500KB total JS
        'resource-summary:stylesheet:size': ['error', { maxNumericValue: 102400 }], // 100KB total CSS
        'resource-summary:image:size': ['warn', { maxNumericValue: 1048576 }], // 1MB total images
        'resource-summary:font:size': ['warn', { maxNumericValue: 204800 }], // 200KB total fonts
        'total-byte-weight': ['error', { maxNumericValue: 2097152 }], // 2MB total

        // Modern best practices
        'uses-rel-preconnect': 'warn',
        'uses-rel-preload': 'warn',
        'unused-css-rules': 'warn',
        'unused-javascript': 'warn',
        'modern-image-formats': 'warn',
        'offscreen-images': 'warn',
        'render-blocking-resources': 'warn',
        'unminified-css': 'error',
        'unminified-javascript': 'error',
        'efficient-animated-content': 'warn',

        // Next.js specific
        'uses-text-compression': 'warn',
        'uses-optimized-images': 'warn',
      },
    },
    upload: {
      target: 'temporary-public-storage',
      // For production, use:
      // target: 'lhci',
      // serverBaseUrl: 'https://your-lhci-server.com',
      // token: process.env.LHCI_TOKEN,
    },
    server: {
      // Optional: Configure LHCI server for historical tracking
      // port: 9001,
      // storage: {
      //   storageMethod: 'sql',
      //   sqlDialect: 'postgres',
      //   sqlConnectionUrl: process.env.DATABASE_URL,
      // },
    },
  },
};
