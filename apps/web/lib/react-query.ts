import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
      refetchOnMount: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

// Query keys for consistent cache management
export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: Record<string, any>) =>
      [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    executions: (id: string) =>
      [...queryKeys.projects.detail(id), 'executions'] as const,
  },
  workflows: {
    all: ['workflows'] as const,
    detail: (id: string) => [...queryKeys.workflows.all, id] as const,
  },
  agents: {
    all: ['agents'] as const,
    execution: (id: string) => [...queryKeys.agents.all, id] as const,
  },
} as const;
