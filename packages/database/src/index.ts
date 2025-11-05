/**
 * @business-automation/database
 * Database layer with Prisma ORM for multi-tenant architecture
 */

export * from '@prisma/client';
export { prisma, setTenantContext, clearTenantContext, getCurrentTenantId } from './client';
export { default } from './client';
