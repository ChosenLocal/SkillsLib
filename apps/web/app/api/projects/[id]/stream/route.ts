import { NextRequest, NextResponse } from 'next/server';
import { prisma, setTenantContext } from '@business-automation/database';
import { auth } from '@/lib/auth';

// GET /api/projects/[id]/stream - Server-Sent Events endpoint
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;

  // Get session and tenant ID
  const session = await auth();
  const tenantId = session?.user?.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await setTenantContext(tenantId);

  // Verify project exists and belongs to tenant
  const project = await prisma.project.findFirst({
    where: {
      id: params.id,
      tenantId,
    },
  });

  if (!project) {
    return new Response('Project not found', { status: 404 });
  }

  // Create readable stream for SSE
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection event
      const connectionEvent = `event: connected\ndata: ${JSON.stringify({
        projectId: params.id,
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(encoder.encode(connectionEvent));

      // Poll for updates every 2 seconds
      const intervalId = setInterval(async () => {
        try {
          await setTenantContext(tenantId!);

          // Get latest workflow execution
          const latestWorkflow = await prisma.workflowExecution.findFirst({
            where: {
              projectId: params.id,
              tenantId,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

          // Get recent agent executions (last 10)
          const recentAgents = await prisma.agentExecution.findMany({
            where: {
              projectId: params.id,
              tenantId,
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 10,
          });

          // Send workflow progress update
          if (latestWorkflow) {
            const workflowEvent = `event: workflow.progress\ndata: ${JSON.stringify({
              workflowExecutionId: latestWorkflow.id,
              status: latestWorkflow.status,
              currentStep: latestWorkflow.currentStep,
              currentStepName: latestWorkflow.currentStepName,
              totalSteps: latestWorkflow.totalSteps,
              completedSteps: latestWorkflow.completedSteps,
              progressPercentage: latestWorkflow.progressPercentage,
              iteration: latestWorkflow.iteration,
              timestamp: new Date().toISOString(),
            })}\n\n`;
            controller.enqueue(encoder.encode(workflowEvent));
          }

          // Send agent updates
          for (const agent of recentAgents) {
            const agentEvent = `event: agent.${agent.status.toLowerCase()}\ndata: ${JSON.stringify({
              agentExecutionId: agent.id,
              agentRole: agent.agentRole,
              agentName: agent.agentName,
              layer: agent.layer,
              status: agent.status,
              iteration: agent.iteration,
              executionTimeMs: agent.executionTimeMs,
              timestamp: agent.updatedAt.toISOString(),
            })}\n\n`;
            controller.enqueue(encoder.encode(agentEvent));
          }
        } catch (err) {
          console.error('SSE error:', err);
          // Don't close the stream on error, just log it
        }
      }, 2000);

      // Cleanup on connection close
      request.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
