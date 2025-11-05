/**
 * Lint-staged configuration
 *
 * Runs linters and formatters on staged files before commit.
 */

module.exports = {
  // TypeScript/JavaScript files
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix',
    'prettier --write',
  ],

  // JSON files
  '*.json': [
    'prettier --write',
  ],

  // Markdown files
  '*.md': [
    'prettier --write',
  ],

  // Package.json - also validate
  'package.json': [
    'prettier --write',
    () => 'pnpm install --lockfile-only', // Update lockfile
  ],

  // Schema files - run validation
  'packages/schema/src/**/*.ts': [
    () => 'pnpm --filter=@business-automation/schema test',
  ],
};
