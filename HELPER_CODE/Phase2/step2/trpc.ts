import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
import superjson from 'superjson';
import type { AppRouter } from '../../../api/src/routers';

/**
 * Type-safe tRPC React client
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get API URL from environment
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  }

  // SSR should use localhost
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
}

/**
 * Get auth token from session storage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  
  // TODO: Get from NextAuth session in Phase 2
  return localStorage.getItem('auth_token');
}

/**
 * Create tRPC client instance
 */
export function createTRPCClient() {
  return trpc.createClient({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: `${getBaseUrl()}/trpc`,
        headers() {
          const token = getAuthToken();
          return {
            authorization: token ? `Bearer ${token}` : '',
          };
        },
      }),
    ],
  });
}
