import { AgentRole, AgentLayer, type AgentStatus } from '@business-automation/database';
import type { AgentManifest, AgentResult } from '@business-automation/schema';
import { BaseAgent, type ExtendedAgentContext, type AgentConfig } from '../shared/base-agent';
import { createUserMessage } from '../shared/claude-client';

/**
 * Business requirements output schema
 */
export interface BusinessRequirementsOutput {
  companyName: string;
  industry: string;
  targetAudience: string;
  primaryGoals: string[];
  keyMessages: string[];
  valuePropositions: string[];
  competitiveAdvantages: string[];
  brandAttributes: string[];
  mustHaveFeatures: string[];
  niceToHaveFeatures: string[];
  constraints: string[];
  successMetrics: string[];
}

/**
 * BusinessRequirements Agent
 *
 * Analyzes client input to extract comprehensive business requirements
 * for website generation.
 */
export class BusinessRequirementsAgent extends BaseAgent {
  static manifest: AgentManifest = {
    role: 'BUSINESS_REQUIREMENTS' as AgentRole,
    layer: 'DISCOVERY' as AgentLayer,
    name: 'Business Requirements Analyzer',
    description:
      'Analyzes client input to extract business requirements, goals, target audience, and key messages',
    version: '1.0.0',
    dependencies: [],
    inputs: {
      type: 'object',
      properties: {
        projectDescription: { type: 'string' },
        companyProfile: { type: 'object' },
        additionalContext: { type: 'string' },
      },
      required: ['projectDescription'],
    },
    outputs: {
      type: 'object',
      properties: {
        companyName: { type: 'string' },
        industry: { type: 'string' },
        targetAudience: { type: 'string' },
        primaryGoals: { type: 'array' },
        keyMessages: { type: 'array' },
        valuePropositions: { type: 'array' },
        competitiveAdvantages: { type: 'array' },
        brandAttributes: { type: 'array' },
        mustHaveFeatures: { type: 'array' },
        niceToHaveFeatures: { type: 'array' },
        constraints: { type: 'array' },
        successMetrics: { type: 'array' },
      },
    },
  };

  constructor(context: ExtendedAgentContext, config?: AgentConfig) {
    super(context, config);
  }

  protected getAgentRole(): AgentRole {
    return 'BUSINESS_REQUIREMENTS';
  }

  protected getAgentLayer(): AgentLayer {
    return 'DISCOVERY';
  }

  /**
   * Execute business requirements analysis
   */
  protected async execute(input: any): Promise<AgentResult> {
    const { projectDescription, companyProfile, additionalContext } = input;

    // Log progress
    await this.logProgress('Analyzing business requirements...', 10);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt();

    // Build user message
    const userMessage = this.buildUserMessage(projectDescription, companyProfile, additionalContext);

    // Send to Claude
    await this.logProgress('Generating requirements analysis...', 30);

    const response = await this.sendMessage(
      [createUserMessage(userMessage)],
      systemPrompt,
      {
        temperature: 0.5, // Lower temperature for more structured output
      }
    );

    await this.logProgress('Processing response...', 70);

    // Parse response
    const output = this.parseResponse(response.text);

    // Save to database
    await this.saveToDatabase(output);

    await this.logProgress('Business requirements analysis complete', 100);

    return {
      output,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: response.usage.cost?.totalCost,
    };
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(): string {
    return `You are an expert business analyst specializing in extracting structured requirements from client briefs.

Your task is to analyze the provided information and extract comprehensive business requirements in a structured format.

Focus on:
1. Company identity and positioning
2. Target audience and market
3. Business goals and objectives
4. Key messages and value propositions
5. Competitive advantages
6. Feature requirements (must-have vs nice-to-have)
7. Constraints and limitations
8. Success metrics

Output your analysis as a valid JSON object with the following structure:
{
  "companyName": "string",
  "industry": "string",
  "targetAudience": "detailed description of target audience",
  "primaryGoals": ["goal1", "goal2", ...],
  "keyMessages": ["message1", "message2", ...],
  "valuePropositions": ["value1", "value2", ...],
  "competitiveAdvantages": ["advantage1", "advantage2", ...],
  "brandAttributes": ["attribute1", "attribute2", ...],
  "mustHaveFeatures": ["feature1", "feature2", ...],
  "niceToHaveFeatures": ["feature1", "feature2", ...],
  "constraints": ["constraint1", "constraint2", ...],
  "successMetrics": ["metric1", "metric2", ...]
}

Be thorough and specific. Infer information from context when not explicitly stated.`;
  }

  /**
   * Build user message
   */
  private buildUserMessage(
    projectDescription: string,
    companyProfile?: any,
    additionalContext?: string
  ): string {
    let message = `Analyze the following project and extract structured business requirements:\n\n`;

    message += `## Project Description\n${projectDescription}\n\n`;

    if (companyProfile) {
      message += `## Company Profile\n`;
      message += `Name: ${companyProfile.name || 'Not provided'}\n`;
      message += `Industry: ${companyProfile.industry || 'Not provided'}\n`;
      message += `Description: ${companyProfile.description || 'Not provided'}\n`;
      message += `Target Market: ${companyProfile.targetMarket || 'Not provided'}\n\n`;
    }

    if (additionalContext) {
      message += `## Additional Context\n${additionalContext}\n\n`;
    }

    message += `Please provide your analysis as a JSON object.`;

    return message;
  }

  /**
   * Parse Claude response to extract structured output
   */
  private parseResponse(text: string): BusinessRequirementsOutput {
    // Extract JSON from response (Claude sometimes wraps it in markdown)
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    // Validate and return
    return {
      companyName: parsed.companyName || 'Unknown',
      industry: parsed.industry || 'General',
      targetAudience: parsed.targetAudience || 'General audience',
      primaryGoals: parsed.primaryGoals || [],
      keyMessages: parsed.keyMessages || [],
      valuePropositions: parsed.valuePropositions || [],
      competitiveAdvantages: parsed.competitiveAdvantages || [],
      brandAttributes: parsed.brandAttributes || [],
      mustHaveFeatures: parsed.mustHaveFeatures || [],
      niceToHaveFeatures: parsed.niceToHaveFeatures || [],
      constraints: parsed.constraints || [],
      successMetrics: parsed.successMetrics || [],
    };
  }

  /**
   * Save output to database
   */
  private async saveToDatabase(output: BusinessRequirementsOutput): Promise<void> {
    // Update project with extracted requirements
    await this.prisma.project.update({
      where: { id: this.context.projectId },
      data: {
        requirements: output as any,
      },
    });
  }
}
