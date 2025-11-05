'use client';

import { useEffect, useRef, useState } from 'react';
import { SSEClient } from '@/lib/sse-client';
import type { SSEEvent, WorkflowProgressEvent, AgentEvent } from '@/types/events';

export interface ProjectStreamData {
  workflow: WorkflowProgressEvent | null;
  agents: Map<string, AgentEvent>;
  isConnected: boolean;
  error: Error | null;
}

/**
 * Hook to stream real-time project updates via Server-Sent Events
 */
export function useProjectStream(projectId: string | null) {
  const [data, setData] = useState<ProjectStreamData>({
    workflow: null,
    agents: new Map(),
    isConnected: false,
    error: null,
  });

  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    // Create SSE client
    const client = new SSEClient({
      url: `/api/projects/${projectId}/stream`,
      onEvent: (event: SSEEvent) => {
        setData((prev) => {
          const newData = { ...prev };

          switch (event.type) {
            case 'connected':
              newData.isConnected = true;
              newData.error = null;
              break;

            case 'workflow.progress':
              newData.workflow = event.data;
              break;

            case 'agent.pending':
            case 'agent.running':
            case 'agent.completed':
            case 'agent.failed':
            case 'agent.cancelled':
              const agentData = event.data;
              const newAgents = new Map(prev.agents);
              newAgents.set(agentData.agentExecutionId, agentData);
              newData.agents = newAgents;
              break;
          }

          return newData;
        });
      },
      onError: (error) => {
        console.error('SSE connection error:', error);
        setData((prev) => ({
          ...prev,
          isConnected: false,
          error: new Error('Connection error'),
        }));
      },
      onOpen: () => {
        setData((prev) => ({
          ...prev,
          isConnected: true,
          error: null,
        }));
      },
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    });

    client.connect();
    clientRef.current = client;

    // Cleanup on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, [projectId]);

  return data;
}
