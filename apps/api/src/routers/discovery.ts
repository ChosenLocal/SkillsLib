/**
 * Discovery Router
 *
 * tRPC router for AI-powered discovery chat sessions.
 * Handles conversational schema collection, extraction, and export.
 */

import { router, protectedProcedure } from '../trpc.js';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { DiscoverySessionStatus } from '@prisma/client';

/**
 * Message schema for chat history
 */
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().datetime(),
});

/**
 * Input schema for starting a new discovery session
 */
const StartSessionInput = z.object({
  projectId: z.string().uuid().optional(),
  companyProfileId: z.string().uuid().optional(),
});

/**
 * Input schema for sending a message
 */
const SendMessageInput = z.object({
  sessionId: z.string().uuid(),
  message: z.string().min(1).max(5000),
});

/**
 * Input schema for getting a session
 */
const GetSessionInput = z.object({
  sessionId: z.string().uuid(),
});

/**
 * Input schema for exporting schema data
 */
const ExportSchemaInput = z.object({
  sessionId: z.string().uuid(),
  format: z.enum(['json', 'yaml']).default('json'),
});

/**
 * Input schema for saving to profile
 */
const SaveToProfileInput = z.object({
  sessionId: z.string().uuid(),
  targetType: z.enum(['companyProfile', 'project']),
  targetId: z.string().uuid().optional(), // Optional: creates new if not provided
});

/**
 * Helper function to convert JSON to simple YAML format
 * For production, consider using a library like 'js-yaml'
 */
function convertToYAML(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let yaml = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      yaml += `${spaces}${key}: null\n`;
    } else if (Array.isArray(value)) {
      yaml += `${spaces}${key}:\n`;
      value.forEach((item) => {
        if (typeof item === 'object') {
          yaml += `${spaces}- \n${convertToYAML(item, indent + 1)}`;
        } else {
          yaml += `${spaces}- ${item}\n`;
        }
      });
    } else if (typeof value === 'object') {
      yaml += `${spaces}${key}:\n${convertToYAML(value, indent + 1)}`;
    } else {
      yaml += `${spaces}${key}: ${value}\n`;
    }
  }

  return yaml;
}

export const discoveryRouter = router({
  /**
   * Start a new discovery chat session
   */
  startSession: protectedProcedure
    .input(StartSessionInput)
    .mutation(async ({ ctx, input }) => {
      const { projectId, companyProfileId } = input;

      // Verify project or company profile belongs to user's tenant if provided
      if (projectId) {
        const project = await ctx.prisma.project.findFirst({
          where: {
            id: projectId,
            tenantId: ctx.user.tenantId,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found or access denied',
          });
        }
      }

      if (companyProfileId) {
        const profile = await ctx.prisma.companyProfile.findFirst({
          where: {
            id: companyProfileId,
            tenantId: ctx.user.tenantId,
          },
        });

        if (!profile) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Company profile not found or access denied',
          });
        }
      }

      // Generate initial AI greeting
      const initialMessage = {
        role: 'assistant' as const,
        content: `Hello! I'm here to help you build a comprehensive profile for your website project.

I'll ask you questions about your business, brand, services, target audience, and more. Don't worry - we'll take this step by step, and you can always come back to edit your answers later.

To get started, could you tell me about your business? What's your company name and what industry are you in?`,
        timestamp: new Date().toISOString(),
      };

      // Create the discovery session
      const session = await ctx.prisma.discoverySession.create({
        data: {
          tenantId: ctx.user.tenantId,
          userId: ctx.user.id,
          projectId,
          companyProfileId,
          status: 'ACTIVE',
          extractedData: {},
          completeness: 0,
          messages: [initialMessage],
        },
      });

      return {
        sessionId: session.id,
        message: initialMessage,
        status: session.status,
      };
    }),

  /**
   * Send a message in a discovery session
   */
  sendMessage: protectedProcedure
    .input(SendMessageInput)
    .mutation(async ({ ctx, input }) => {
      const { sessionId, message } = input;

      // Fetch session
      const session = await ctx.prisma.discoverySession.findFirst({
        where: {
          id: sessionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Discovery session not found or access denied',
        });
      }

      // Check session is still active
      if (session.status !== 'ACTIVE') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot send message to ${session.status.toLowerCase()} session`,
        });
      }

      // Add user message to history
      const userMessage = {
        role: 'user' as const,
        content: message,
        timestamp: new Date().toISOString(),
      };

      const messages = (session.messages as any[]) || [];
      messages.push(userMessage);

      // Call Discovery Chat Agent
      // Note: Import at top of file - will need to add this
      const { DiscoveryChatAgent } = await import('@business-automation/agents/discovery/discovery-chat');
      const agent = new DiscoveryChatAgent();

      const result = await agent.chat(
        messages,
        session.extractedData as Record<string, any>
      );

      // Add AI response to history
      const assistantMessage = {
        role: 'assistant' as const,
        content: result.response,
        timestamp: new Date().toISOString(),
      };

      messages.push(assistantMessage);

      // Update session in database
      const updatedSession = await ctx.prisma.discoverySession.update({
        where: { id: sessionId },
        data: {
          messages,
          extractedData: result.extractedData,
          completeness: result.completeness,
          updatedAt: new Date(),
        },
      });

      return {
        message: assistantMessage,
        extractedData: result.extractedData,
        completeness: result.completeness,
        updatedAt: updatedSession.updatedAt,
      };
    }),

  /**
   * Get a discovery session by ID
   */
  getSession: protectedProcedure
    .input(GetSessionInput)
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.discoverySession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Discovery session not found or access denied',
        });
      }

      return {
        id: session.id,
        status: session.status,
        messages: session.messages as any[], // Type assertion for JSON field
        extractedData: session.extractedData as Record<string, any>,
        completeness: session.completeness,
        projectId: session.projectId,
        companyProfileId: session.companyProfileId,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        completedAt: session.completedAt,
      };
    }),

  /**
   * Export collected schema data
   */
  exportSchema: protectedProcedure
    .input(ExportSchemaInput)
    .query(async ({ ctx, input }) => {
      const session = await ctx.prisma.discoverySession.findFirst({
        where: {
          id: input.sessionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Discovery session not found or access denied',
        });
      }

      // Get company name for filename (if available)
      let companyName = 'client';
      const extractedData = session.extractedData as Record<string, any>;
      if (extractedData?.company?.name) {
        companyName = extractedData.company.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');
      }

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${companyName}-schema-${timestamp}.${input.format}`;

      // Format data based on requested format
      let data: string;
      if (input.format === 'yaml') {
        // Simple YAML conversion (for full YAML support, could use a library like 'js-yaml')
        data = convertToYAML(extractedData);
      } else {
        data = JSON.stringify(extractedData, null, 2);
      }

      return {
        data,
        filename,
        completeness: session.completeness,
      };
    }),

  /**
   * Save collected data to CompanyProfile or Project
   */
  saveToProfile: protectedProcedure
    .input(SaveToProfileInput)
    .mutation(async ({ ctx, input }) => {
      const { sessionId, targetType, targetId } = input;

      // Fetch session
      const session = await ctx.prisma.discoverySession.findFirst({
        where: {
          id: sessionId,
          tenantId: ctx.user.tenantId,
        },
      });

      if (!session) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Discovery session not found or access denied',
        });
      }

      const extractedData = session.extractedData as Record<string, any>;

      // Validate that we have some data to save
      if (!extractedData || Object.keys(extractedData).length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No data collected yet. Continue the conversation to collect more information.',
        });
      }

      let savedId: string;

      if (targetType === 'companyProfile') {
        // Save to CompanyProfile
        if (targetId) {
          // Update existing profile
          const existingProfile = await ctx.prisma.companyProfile.findFirst({
            where: {
              id: targetId,
              tenantId: ctx.user.tenantId,
            },
          });

          if (!existingProfile) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Company profile not found or access denied',
            });
          }

          // Merge extracted data with existing profile
          const updated = await ctx.prisma.companyProfile.update({
            where: { id: targetId },
            data: {
              // Update basic fields if available
              name: extractedData.company?.name || existingProfile.name,
              legalName: extractedData.company?.legalName || existingProfile.legalName,
              tagline: extractedData.company?.tagline || existingProfile.tagline,
              industry: extractedData.company?.industry || existingProfile.industry,
              // Merge JSON fields
              brand: extractedData.brand || existingProfile.brand,
              services: extractedData.offerings?.services || existingProfile.services,
              seo: extractedData.local || existingProfile.seo,
              // ... could add more field mappings
            },
          });

          savedId = updated.id;
        } else {
          // Create new profile
          const newProfile = await ctx.prisma.companyProfile.create({
            data: {
              tenantId: ctx.user.tenantId,
              name: extractedData.company?.name || 'Untitled Company',
              legalName: extractedData.company?.legalName || extractedData.company?.name || 'Untitled Company',
              tagline: extractedData.company?.tagline || '',
              industry: extractedData.company?.industry || '',
              brand: extractedData.brand || {},
              services: extractedData.offerings?.services || {},
              seo: extractedData.local || {},
              contact: extractedData.company?.contact || {},
              locations: extractedData.locations || {},
              hours: {},
              serviceAreas: {},
              certifications: {},
              licenses: {},
              insurance: {},
              manufacturerCerts: {},
              industryAffiliations: {},
              teamMembers: extractedData.team || {},
              projects: {},
              testimonials: extractedData.credibility?.testimonials || {},
              awards: extractedData.credibility?.awards || {},
              caseStudies: extractedData.credibility?.caseStudies || {},
              metrics: {},
              websiteConfig: extractedData.website || {},
            },
          });

          savedId = newProfile.id;
        }
      } else {
        // Save to Project
        if (!targetId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'targetId is required when saving to project',
          });
        }

        const project = await ctx.prisma.project.findFirst({
          where: {
            id: targetId,
            tenantId: ctx.user.tenantId,
          },
        });

        if (!project) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Project not found or access denied',
          });
        }

        // Update project discovery data
        await ctx.prisma.project.update({
          where: { id: targetId },
          data: {
            discoveryData: extractedData,
          },
        });

        savedId = targetId;
      }

      // Mark session as completed
      await ctx.prisma.discoverySession.update({
        where: { id: sessionId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        targetType,
        targetId: savedId,
        message: `Successfully saved discovery data to ${targetType}`,
      };
    }),

  /**
   * List discovery sessions for current user
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.nativeEnum(DiscoverySessionStatus).optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO: Implement list
      // 1. Query sessions for user's tenant
      // 2. Filter by status if provided
      // 3. Order by updatedAt desc
      // 4. Return sessions with basic info (id, status, completeness, createdAt, updatedAt)

      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'list not yet implemented',
      });
    }),

  /**
   * Delete a discovery session
   */
  delete: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement delete
      // 1. Verify session exists and belongs to user's tenant
      // 2. Delete session from database
      // 3. Return success

      throw new TRPCError({
        code: 'NOT_IMPLEMENTED',
        message: 'delete not yet implemented',
      });
    }),
});
