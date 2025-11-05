import { redirect } from 'next/navigation';
import { auth } from './auth';

// Temporary flag to disable auth for testing
const DISABLE_AUTH = process.env.DISABLE_AUTH === 'true';
const MOCK_TENANT_ID = process.env.MOCK_TENANT_ID || 'test-tenant-123';

// Mock user for testing when auth is disabled
const MOCK_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  tenantId: MOCK_TENANT_ID,
  role: 'OWNER' as const,
};

/**
 * Get current authenticated user session
 * Returns null if not authenticated
 */
export async function getCurrentUser() {
  if (DISABLE_AUTH) {
    return MOCK_USER;
  }

  const session = await auth();
  return session?.user ?? null;
}

/**
 * Require authenticated user or redirect to login
 */
export async function requireAuth() {
  if (DISABLE_AUTH) {
    return MOCK_USER;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect('/');
  }

  return user;
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, requiredRole: string): boolean {
  const roleHierarchy = {
    OWNER: 4,
    ADMIN: 3,
    MEMBER: 2,
    VIEWER: 1,
  };

  return (
    roleHierarchy[userRole as keyof typeof roleHierarchy] >=
    roleHierarchy[requiredRole as keyof typeof roleHierarchy]
  );
}

/**
 * Require specific role or redirect
 */
export async function requireRole(requiredRole: string) {
  const user = await requireAuth();

  if (!hasRole(user.role, requiredRole)) {
    redirect('/dashboard');
  }

  return user;
}
