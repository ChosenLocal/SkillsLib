'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import type { AgentEvent } from '@/types/events';

interface AgentExecutionCardProps {
  agent: AgentEvent;
}

export function AgentExecutionCard({ agent }: AgentExecutionCardProps) {
  const getStatusIcon = () => {
    switch (agent.status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'RUNNING':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusVariant = (): any => {
    switch (agent.status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'destructive';
      case 'RUNNING':
        return 'info';
      case 'PENDING':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <Card className="transition-all hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="mt-0.5">{getStatusIcon()}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{agent.agentName}</p>
              <p className="text-sm text-muted-foreground truncate">
                {agent.agentRole}
              </p>
              {agent.executionTimeMs !== undefined && agent.status === 'COMPLETED' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Completed in {(agent.executionTimeMs / 1000).toFixed(2)}s
                </p>
              )}
            </div>
          </div>
          <Badge variant={getStatusVariant()} className="shrink-0">
            {agent.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
