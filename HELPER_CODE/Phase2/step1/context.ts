import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma, setTenantContext } from '@business-automation/database';
import { env } from '@business-automation/config';
import { logger } from '@business-automation/config';

/**
 * JWT Payload Structure
 */
export interface JWTPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Context for authenticated requests
 */
export interface AuthenticatedContext {
  req: Request;
  res: Response;
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
  prisma: typeof prisma;
}

/**
 * Context for unauthenticated requests
 */
export interface UnauthenticatedContext {
  req: Request;
  res: Response;
  user: null;
  prisma: typeof prisma;
}

export type Context = AuthenticatedContext | UnauthenticatedContext;

/**
 * Verify JWT token and extract user data
 */
function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, env.NEXTAUTH_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    logger.warn('Invalid JWT token', { error });
    return null;
  }
}

/**
 * Create tRPC context
 * Extracts auth token, verifies it, and sets tenant context for RLS
 */
export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<Context> {
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token) {
    return {
      req,
      res,
      user: null,
      prisma,
    };
  }

  // Verify token
  const payload = verifyToken(token);
  if (!payload) {
    return {
      req,
      res,
      user: null,
      prisma,
    };
  }

  // Set tenant context for Row-Level Security
  await setTenantContext(payload.tenantId);

  // Return authenticated context
  return {
    req,
    res,
    user: {
      id: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role,
    },
    prisma,
  };
}

export type { Request, Response };
