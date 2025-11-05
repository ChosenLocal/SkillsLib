'use client';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { AgentExecutionCard } from './agent-execution-card';
import type { AgentEvent } from '@/types/events';

interface AgentLayerSectionProps {
  layer: string;
  agents: AgentEvent[];
}

const layerLabels: Record<string, string> = {
  ORCHESTRATOR: 'Orchestrator',
  DISCOVERY: 'Discovery Layer',
  DESIGN: 'Design & Branding Layer',
  CONTENT: 'Content Generation Layer',
  CODE: 'Code Generation Layer',
  QUALITY: 'Quality Grading Layer',
};

const layerDescriptions: Record<string, string> = {
  ORCHESTRATOR: 'Coordinates the entire workflow execution',
  DISCOVERY: 'Analyzes requirements and gathers information',
  DESIGN: 'Creates brand identity and visual design',
  CONTENT: 'Generates text content and copy',
  CODE: 'Builds the technical implementation',
  QUALITY: 'Evaluates output quality and provides feedback',
};

export function AgentLayerSection({ layer, agents }: AgentLayerSectionProps) {
  const label = layerLabels[layer] || layer;
  const description = layerDescriptions[layer] || '';

  const completedCount = agents.filter((a) => a.status === 'COMPLETED').length;
  const failedCount = agents.filter((a) => a.status === 'FAILED').length;
  const runningCount = agents.filter((a) => a.status === 'RUNNING').length;

  return (
    <Accordion type="single" collapsible defaultValue={`layer-${layer}`}>
      <AccordionItem value={`layer-${layer}`}>
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center justify-between w-full pr-4">
            <div className="text-left">
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex gap-2">
              {runningCount > 0 && (
                <Badge variant="info">{runningCount} running</Badge>
              )}
              {completedCount > 0 && (
                <Badge variant="success">{completedCount} completed</Badge>
              )}
              {failedCount > 0 && (
                <Badge variant="destructive">{failedCount} failed</Badge>
              )}
              <Badge variant="outline">{agents.length} total</Badge>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-2 pt-2">
            {agents.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No agents executed yet
              </p>
            ) : (
              agents.map((agent) => (
                <AgentExecutionCard key={agent.agentExecutionId} agent={agent} />
              ))
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
