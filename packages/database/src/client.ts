import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client Singleton
 * Ensures we don't create multiple instances in development
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Set tenant context for Row-Level Security
 * Call this in middleware before database queries
 */
export async function setTenantContext(tenantId: string) {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`;
}

/**
 * Clear tenant context
 */
export async function clearTenantContext() {
  await prisma.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
}

/**
 * Get current tenant ID from context
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const result = await prisma.$queryRaw<[{ current_setting: string }]>`
    SELECT current_setting('app.current_tenant_id', true) as current_setting
  `;
  return result[0]?.current_setting || null;
}

export default prisma;
