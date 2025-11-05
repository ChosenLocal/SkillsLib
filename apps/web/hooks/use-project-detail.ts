'use client';

import { trpc } from '@/lib/trpc/react';

export function useProjectDetail(projectId: string) {
  return trpc.project.getById.useQuery(
    { id: projectId },
    {
      refetchInterval: 5000, // Refetch every 5 seconds for non-streaming data
      enabled: !!projectId,
    }
  );
}
