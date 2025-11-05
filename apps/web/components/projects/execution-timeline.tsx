'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AgentLayerSection } from './agent-layer-section';
import type { AgentEvent } from '@/types/events';

interface ExecutionTimelineProps {
  agents: Map<string, AgentEvent>;
}

const layerOrder = [
  'ORCHESTRATOR',
  'DISCOVERY',
  'DESIGN',
  'CONTENT',
  'CODE',
  'QUALITY',
];

export function ExecutionTimeline({ agents }: ExecutionTimelineProps) {
  // Group agents by layer
  const agentsByLayer = new Map<string, AgentEvent[]>();

  agents.forEach((agent) => {
    const layer = agent.layer;
    if (!agentsByLayer.has(layer)) {
      agentsByLayer.set(layer, []);
    }
    agentsByLayer.get(layer)!.push(agent);
  });

  // Sort agents within each layer by timestamp
  agentsByLayer.forEach((layerAgents) => {
    layerAgents.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent Execution Timeline</CardTitle>
        <p className="text-sm text-muted-foreground">
          Real-time updates from AI agents working on your project
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {layerOrder.map((layer) => {
          const layerAgents = agentsByLayer.get(layer) || [];
          return (
            <AgentLayerSection
              key={layer}
              layer={layer}
              agents={layerAgents}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
