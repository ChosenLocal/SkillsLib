import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env.local file BEFORE anything else
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env.local') });

import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context, AuthenticatedContext } from './context.js';

/**
 * DISABLE_AUTH flag for development/testing
 * When true, bypasses authentication and uses mock user
 */
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';

if (DISABLE_AUTH) {
  console.warn('⚠️  WARNING: Authentication is DISABLED. This should only be used in development!');
  console.log('📝 Mock user: test@example.com (OWNER, tenant: test-tenant-id)');
}

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof Error && error.cause.name === 'ZodError'
            ? error.cause
            : null,
      },
    };
  },
});

/**
 * Base router and procedure
 */
export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware to enforce authentication
 * Bypassed when DISABLE_AUTH=true for development
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  // If auth is disabled, use mock user
  if (DISABLE_AUTH) {
    return next({
      ctx: {
        ...ctx,
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          tenantId: 'test-tenant-id',
          role: 'OWNER',
        },
      } as AuthenticatedContext,
    });
  }

  // Normal authentication flow
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    } as AuthenticatedContext,
  });
});

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Middleware to check user role
 */
export const requireRole = (allowedRoles: string[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'You must be logged in',
      });
    }

    if (!allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`,
      });
    }

    return next({
      ctx: ctx as AuthenticatedContext,
    });
  });

/**
 * Admin-only procedure (OWNER or ADMIN roles)
 */
export const adminProcedure = protectedProcedure.use(
  requireRole(['OWNER', 'ADMIN'])
);

/**
 * Owner-only procedure
 */
export const ownerProcedure = protectedProcedure.use(requireRole(['OWNER']));

/**
 * Logging middleware for performance tracking
 */
const loggingMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();

  const result = await next();

  const durationMs = Date.now() - start;

  console.log({
    type: 'trpc_call',
    path,
    callType: type,
    durationMs,
    success: result.ok,
  });

  return result;
});

/**
 * Logged public procedure
 */
export const loggedPublicProcedure = publicProcedure.use(loggingMiddleware);

/**
 * Logged protected procedure
 */
export const loggedProtectedProcedure = protectedProcedure.use(loggingMiddleware);
