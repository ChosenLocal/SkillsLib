import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { createContext } from './context';
import { appRouter } from './routers';
import { initWSManager } from './websocket/server';
import { env, logger } from '@business-automation/config';
import { prisma } from '@business-automation/database';
import { createServer } from 'http';

const PORT = process.env.API_PORT || 3001;

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
    origin: env.NEXTAUTH_URL || 'http://localhost:3000',
    credentials: true,
  })
);

/**
 * Rate limiting
 * Prevents abuse and DDoS
 */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
    });
  } catch (error) {
    logger.error('Health check failed', { error });
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
      logger.error('tRPC error', {
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
    logger.error('Unhandled error', { error: err });
    res.status(500).json({
      error: 'Internal Server Error',
      message: env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
    });
  }
);

/**
 * Create HTTP server and initialize WebSocket
 */
const server = createServer(app);
const wsManager = initWSManager(server);

/**
 * Start server
 */
server.listen(PORT, () => {
  logger.info(`🚀 API server running on http://localhost:${PORT}`);
  logger.info(`🔌 WebSocket server available at ws://localhost:${PORT}/ws`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔗 tRPC endpoint: http://localhost:${PORT}/trpc`);
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  process.exit(1);
});

export { app, server, wsManager };
