import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

/**
 * 🛡️ PRODUCTION SAFETY CHECK
 * Prevent deploying to production with authentication disabled
 */
if (process.env.NODE_ENV === 'production' && process.env.DISABLE_AUTH === 'true') {
  console.error('🚨 CRITICAL SECURITY ERROR: Cannot run in production with DISABLE_AUTH=true');
  console.error('   This would allow unauthenticated access to all endpoints.');
  console.error('   Please set DISABLE_AUTH=false in your production environment.');
  process.exit(1);
}

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createContext } from './context.js';
import { prisma } from '@business-automation/database';
import { createServer } from 'http';
import { appRouter } from './routers/index.js';

const PORT = process.env.API_PORT || 3001;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

/**
 * Create Express app
 */
const app = express();

/**
 * Security middleware
 */
app.use(helmet());

/**
 * CORS configuration
 * Allow requests from Next.js frontend
 */
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);

/**
 * Rate limiting
 * Prevents abuse and DDoS
 */
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/trpc', limiter);

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: '1.0.0',
    });
  } catch (error) {
    console.error('Health check failed', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

/**
 * tRPC middleware
 */
app.use(
  '/trpc',
  createExpressMiddleware({
    router: appRouter,
    createContext,
    onError({ error, type, path, input, ctx, req }) {
      console.error('tRPC error', {
        error: error.message,
        code: error.code,
        type,
        path,
        input,
        userId: ctx?.user?.id,
        tenantId: ctx?.user?.tenantId,
      });
    },
  })
);

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

/**
 * Global error handler
 */
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Unhandled error', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    });
  }
);

/**
 * Create HTTP server
 * TODO: Initialize WebSocket server when ready
 */
const server = createServer(app);

/**
 * Start server
 */
server.listen(PORT, () => {
  console.log(`🚀 API server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 tRPC endpoint: http://localhost:${PORT}/trpc`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

export { app, server, appRouter };
export type { AppRouter } from './routers/index.js';
