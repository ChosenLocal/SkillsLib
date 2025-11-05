import { Inngest, EventSchemas } from 'inngest';

/**
 * Inngest event schemas for type safety
 */
export type InngestEvents = {
  'workflow/execute': {
    data: {
      workflowDefinitionId: string;
      projectId: string;
      tenantId: string;
      userId?: string;
      input?: any;
    };
  };
  'website/generate': {
    data: {
      projectId: string;
      companyProfileId: string;
      tenantId: string;
      userId: string;
      constraints?: {
        maxPages?: number;
        maxComponents?: number;
        budget?: {
          maxCostUsd?: number;
          maxTokens?: number;
        };
      };
    };
  };
  'agent/execute': {
    data: {
      agentRole: string;
      agentExecutionId: string;
      workflowExecutionId: string;
      projectId: string;
      tenantId: string;
      userId?: string;
      input: any;
      config?: any;
    };
  };
  'workflow/status.changed': {
    data: {
      workflowExecutionId: string;
      projectId: string;
      tenantId: string;
      status: string;
      previousStatus?: string;
    };
  };
  'agent/status.changed': {
    data: {
      agentExecutionId: string;
      agentRole: string;
      workflowExecutionId: string;
      projectId: string;
      tenantId: string;
      status: string;
      previousStatus?: string;
    };
  };
  'refinement/check': {
    data: {
      workflowExecutionId: string;
      projectId: string;
      tenantId: string;
      iteration: number;
    };
  };
};

/**
 * Create Inngest client
 */
export const inngest = new Inngest({
  id: 'business-automation',
  name: 'Business Automation Platform',
  schemas: new EventSchemas().fromRecord<InngestEvents>(),
});

/**
 * Send workflow execution event
 */
export async function sendWorkflowExecute(data: InngestEvents['workflow/execute']['data']) {
  return inngest.send({
    name: 'workflow/execute',
    data,
  });
}

/**
 * Send website generation event
 */
export async function sendWebsiteGenerate(data: InngestEvents['website/generate']['data']) {
  return inngest.send({
    name: 'website/generate',
    data,
  });
}

/**
 * Send agent execution event
 */
export async function sendAgentExecute(data: InngestEvents['agent/execute']['data']) {
  return inngest.send({
    name: 'agent/execute',
    data,
  });
}

/**
 * Send workflow status changed event
 */
export async function sendWorkflowStatusChanged(
  data: InngestEvents['workflow/status.changed']['data']
) {
  return inngest.send({
    name: 'workflow/status.changed',
    data,
  });
}

/**
 * Send agent status changed event
 */
export async function sendAgentStatusChanged(data: InngestEvents['agent/status.changed']['data']) {
  return inngest.send({
    name: 'agent/status.changed',
    data,
  });
}

/**
 * Send refinement check event
 */
export async function sendRefinementCheck(data: InngestEvents['refinement/check']['data']) {
  return inngest.send({
    name: 'refinement/check',
    data,
  });
}

/**
 * Batch send events
 */
export async function sendBatch(
  events: Array<{
    name: keyof InngestEvents;
    data: any;
  }>
) {
  return inngest.send(events as any);
}
