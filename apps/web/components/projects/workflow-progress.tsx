'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { WorkflowProgressEvent } from '@/types/events';

interface WorkflowProgressProps {
  workflow: WorkflowProgressEvent | null;
}

export function WorkflowProgress({ workflow }: WorkflowProgressProps) {
  if (!workflow) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workflow Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No active workflow execution
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (workflow.status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'RUNNING':
        return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusVariant = () => {
    switch (workflow.status) {
      case 'COMPLETED':
        return 'success';
      case 'FAILED':
        return 'destructive';
      case 'RUNNING':
        return 'info';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Workflow Progress
          </CardTitle>
          <Badge variant={getStatusVariant() as any}>
            {workflow.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">{workflow.currentStepName || 'Processing...'}</span>
            <span className="text-muted-foreground">
              {workflow.completedSteps} / {workflow.totalSteps} steps
            </span>
          </div>
          <Progress value={workflow.progressPercentage} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {workflow.progressPercentage}% complete
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Current Step</p>
            <p className="font-medium">{workflow.currentStep + 1}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Iteration</p>
            <p className="font-medium">{workflow.iteration}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
