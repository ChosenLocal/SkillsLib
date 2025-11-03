/**
 * Application-wide constants
 */

export const APP_NAME = 'Business Automation System';
export const APP_VERSION = '1.0.0';

// Agent Configuration
export const AGENT_CONFIG = {
  DEFAULT_MODEL: 'claude-4.5-sonnet' as const,
  DEFAULT_TEMPERATURE: 0.7,
  DEFAULT_MAX_TOKENS: 4096,
  MAX_RETRIES: 3,
  RETRY_BACKOFF_MS: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2,
};

// Workflow Configuration
export const WORKFLOW_CONFIG = {
  MAX_ITERATIONS: 3,
  MAX_PARALLEL_AGENTS: 5,
  DEFAULT_TIMEOUT_MS: 300000, // 5 minutes
  LONG_RUNNING_TIMEOUT_MS: 1800000, // 30 minutes
};

// Quality Grading Thresholds
export const QUALITY_THRESHOLDS = {
  PASS_SCORE: 0.7, // 70% minimum to pass
  EXCELLENT_SCORE: 0.9, // 90% for excellent grade
  GRADES: {
    A: 0.9,
    B: 0.8,
    C: 0.7,
    D: 0.6,
    F: 0,
  },
};

// Project Configuration
export const PROJECT_CONFIG = {
  MAX_PROJECTS_FREE: 3,
  MAX_PROJECTS_PRO: 50,
  MAX_PROJECTS_ENTERPRISE: -1, // Unlimited
  MAX_STORAGE_GB_FREE: 5,
  MAX_STORAGE_GB_PRO: 100,
  MAX_STORAGE_GB_ENTERPRISE: 1000,
};

// API Configuration
export const API_CONFIG = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  RATE_LIMIT_REQUESTS: 100,
  RATE_LIMIT_WINDOW_MS: 60000, // 1 minute
};

// Cache Configuration
export const CACHE_CONFIG = {
  DEFAULT_TTL_SECONDS: 3600, // 1 hour
  SHORT_TTL_SECONDS: 300, // 5 minutes
  LONG_TTL_SECONDS: 86400, // 24 hours
};

// Website Generation Configuration
export const WEBSITE_CONFIG = {
  SUPPORTED_INDUSTRIES: [
    'roofing',
    'hvac',
    'solar',
    'restoration',
    'plumbing',
    'electrical',
    'auto_repair',
    'mitigation',
  ] as const,
  DEFAULT_FRAMEWORK: 'nextjs' as const,
  DEFAULT_STYLING: 'tailwindcss' as const,
};

// Agent Layers
export const AGENT_LAYERS = {
  ORCHESTRATOR: 'orchestrator',
  DISCOVERY: 'discovery',
  DESIGN: 'design',
  CONTENT: 'content',
  CODE: 'code',
  QUALITY: 'quality',
} as const;

// MCP Server Configuration
export const MCP_SERVERS = {
  PLAYWRIGHT: '@playwright/mcp',
  FILESYSTEM: '@modelcontextprotocol/server-filesystem',
  GIT: '@modelcontextprotocol/server-git',
  POSTGRES: '@modelcontextprotocol/server-postgres',
  SCHEDULER: 'scheduler-mcp',
} as const;

// Observability
export const OBSERVABILITY = {
  TRACE_SAMPLE_RATE: 1.0, // 100% in development
  ERROR_SAMPLE_RATE: 1.0,
};

export type SupportedIndustry = (typeof WEBSITE_CONFIG.SUPPORTED_INDUSTRIES)[number];
