import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context, AuthenticatedContext } from './context';
import { logger } from '@business-automation/config';

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
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
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
 * Admin-only procedure
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

  logger.info({
    type: 'trpc_call',
    path,
    type: type,
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
