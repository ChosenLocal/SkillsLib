/**
 * Commit message linting configuration
 *
 * Enforces conventional commit format:
 * type(scope): subject
 *
 * Examples:
 * - feat(agents): add new planner agent
 * - fix(api): resolve authentication bug
 * - docs(readme): update installation instructions
 */

module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type enum
    'type-enum': [
      2,
      'always',
      [
        'feat',     // New feature
        'fix',      // Bug fix
        'docs',     // Documentation only
        'style',    // Formatting, missing semicolons, etc.
        'refactor', // Code change that neither fixes a bug nor adds a feature
        'perf',     // Performance improvement
        'test',     // Adding or updating tests
        'build',    // Changes to build system or dependencies
        'ci',       // CI configuration changes
        'chore',    // Other changes that don't modify src or test files
        'revert',   // Revert a previous commit
      ],
    ],
    // Subject case
    'subject-case': [2, 'never', ['upper-case']],
    // Subject max length
    'subject-max-length': [2, 'always', 100],
    // Subject min length
    'subject-min-length': [2, 'always', 10],
    // Body max line length
    'body-max-line-length': [2, 'always', 100],
    // Scope enum (optional)
    'scope-enum': [
      1,
      'always',
      [
        'agents',
        'api',
        'web',
        'database',
        'schema',
        'cli',
        'orchestrator',
        'jobs',
        'ci',
        'deps',
        'config',
      ],
    ],
  },
};
