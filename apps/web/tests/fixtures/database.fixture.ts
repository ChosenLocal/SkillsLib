import { PrismaClient } from '@business-automation/database';

const prisma = new PrismaClient();

/**
 * Clean up test data (projects, workflows, agents)
 */
export async function cleanupTestData(tenantId: string) {
  // Delete in order due to foreign key constraints
  await prisma.generatedAsset.deleteMany({ where: { tenantId } });
  await prisma.websiteEvaluation.deleteMany({ where: { tenantId } });
  await prisma.agentExecution.deleteMany({ where: { tenantId } });
  await prisma.workflowExecution.deleteMany({ where: { tenantId } });
  await prisma.project.deleteMany({ where: { tenantId } });

  console.log(`✅ Cleaned up test data for tenant: ${tenantId}`);
}

/**
 * Create test project
 */
export async function createTestProject(
  tenantId: string,
  data: {
    name: string;
    description?: string;
    type: 'WEBSITE' | 'CONTENT' | 'SEO_AUDIT';
    status?: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
    companyProfileId?: string;
  }
) {
  const project = await prisma.project.create({
    data: {
      tenantId,
      name: data.name,
      description: data.description || '',
      type: data.type,
      status: data.status || 'DRAFT',
      companyProfileId: data.companyProfileId,
      discoveryData: {},
      workflowState: {},
      tags: [],
    },
  });

  console.log(`✅ Created test project: ${project.name} (${project.id})`);
  return project;
}

/**
 * Create test workflow execution
 */
export async function createTestWorkflow(
  projectId: string,
  tenantId: string,
  workflowId: string,
  data: {
    status?: 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
    progressPercentage?: number;
    currentStep?: string;
    currentStepName?: string;
  }
) {
  const workflow = await prisma.workflowExecution.create({
    data: {
      tenantId,
      projectId,
      workflowId,
      workflowType: 'WEBSITE_GENERATION',
      workflowVersion: '1.0.0',
      status: data.status || 'QUEUED',
      totalSteps: 5,
      completedSteps: 0,
      progressPercentage: data.progressPercentage || 0,
      currentStep: data.currentStep,
      currentStepName: data.currentStepName,
      input: {},
      context: {},
    },
  });

  console.log(`✅ Created test workflow: ${workflow.id}`);
  return workflow;
}

/**
 * Create test agent execution
 */
export async function createTestAgent(
  projectId: string,
  tenantId: string,
  workflowExecutionId: string,
  data: {
    agentName: string;
    agentRole: string;
    layer: 'DISCOVERY' | 'DESIGN' | 'CONTENT' | 'CODE' | 'QUALITY';
    status?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  }
) {
  const agent = await prisma.agentExecution.create({
    data: {
      tenantId,
      projectId,
      workflowExecutionId,
      agentName: data.agentName,
      agentRole: data.agentRole as any,
      layer: data.layer,
      status: data.status || 'PENDING',
      config: {},
      input: {},
    },
  });

  console.log(`✅ Created test agent: ${agent.agentName} (${agent.id})`);
  return agent;
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug: string) {
  return await prisma.tenant.findUnique({
    where: { slug },
    include: {
      users: true,
      companyProfiles: true,
    },
  });
}

/**
 * Get user by email and tenant ID
 */
export async function getUserByEmail(email: string, tenantId: string) {
  return await prisma.user.findUnique({
    where: {
      email_tenantId: {
        email,
        tenantId,
      },
    },
  });
}

/**
 * Disconnect Prisma client
 */
export async function disconnectDatabase() {
  await prisma.$disconnect();
}
