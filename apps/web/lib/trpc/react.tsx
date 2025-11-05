/**
 * tRPC React Client and Provider
 *
 * This file sets up the tRPC React Query integration for the frontend.
 * It provides type-safe hooks for calling tRPC procedures.
 *
 * IMPORTANT: This client connects to the standalone API server (port 3001)
 * and uses JWT tokens from NextAuth for authentication.
 */

'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, loggerLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useSession } from 'next-auth/react';
import superjson from 'superjson';

// Import AppRouter type from API server
import type { AppRouter } from '@business-automation/api/src/routers';

/**
 * Create typed tRPC React hooks
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Inner TRPCProvider Component
 * Needs to be separate to use useSession hook
 */
function TRPCInner({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        // Log requests in development
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === 'development' ||
            (opts.direction === 'down' && opts.result instanceof Error),
        }),
        // Connect to standalone API server
        httpBatchLink({
          url: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/trpc',
          transformer: superjson,
          headers: () => {
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
            };

            // Skip JWT token when auth is disabled
            const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true';

            // Add JWT token from NextAuth session (only if auth is enabled)
            if (!isAuthDisabled && session?.accessToken) {
              headers['Authorization'] = `Bearer ${session.accessToken}`;
            }

            return headers;
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}

/**
 * tRPC Provider Component
 *
 * Wraps the app with tRPC and React Query providers.
 * Must be used in a Client Component.
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  return <TRPCInner>{children}</TRPCInner>;
}
