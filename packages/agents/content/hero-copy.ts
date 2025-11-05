import { AgentRole, AgentLayer } from '@business-automation/database';
import type { AgentManifest, AgentResult } from '@business-automation/schema';
import { BaseAgent, type ExtendedAgentContext, type AgentConfig } from '../shared/base-agent';
import { createUserMessage } from '../shared/claude-client';

/**
 * Hero copy output schema
 */
export interface HeroCopyOutput {
  headline: string;
  subheadline: string;
  ctaPrimary: {
    text: string;
    action: string;
  };
  ctaSecondary?: {
    text: string;
    action: string;
  };
  supportingText?: string;
  variants: Array<{
    headline: string;
    subheadline: string;
    reasoning: string;
  }>;
  seoKeywords: string[];
  rationale: string;
}

/**
 * HeroCopy Agent
 *
 * Generates compelling hero section copy based on business requirements
 * and brand messaging.
 */
export class HeroCopyAgent extends BaseAgent {
  static manifest: AgentManifest = {
    role: 'HERO_COPY' as AgentRole,
    layer: 'CONTENT' as AgentLayer,
    name: 'Hero Copy Generator',
    description:
      'Generates compelling, conversion-focused hero section copy with headline, subheadline, and CTAs',
    version: '1.0.0',
    dependencies: ['BUSINESS_REQUIREMENTS'],
    inputs: {
      type: 'object',
      properties: {
        businessRequirements: { type: 'object' },
        tone: { type: 'string', enum: ['professional', 'casual', 'friendly', 'authoritative', 'playful'] },
        maxHeadlineLength: { type: 'number' },
        includeVariants: { type: 'boolean' },
      },
      required: ['businessRequirements'],
    },
    outputs: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        subheadline: { type: 'string' },
        ctaPrimary: { type: 'object' },
        ctaSecondary: { type: 'object' },
        supportingText: { type: 'string' },
        variants: { type: 'array' },
        seoKeywords: { type: 'array' },
        rationale: { type: 'string' },
      },
    },
  };

  constructor(context: ExtendedAgentContext, config?: AgentConfig) {
    super(context, config);
  }

  protected getAgentRole(): AgentRole {
    return 'HERO_COPY';
  }

  protected getAgentLayer(): AgentLayer {
    return 'CONTENT';
  }

  /**
   * Execute hero copy generation
   */
  protected async execute(input: any): Promise<AgentResult> {
    const {
      businessRequirements,
      tone = 'professional',
      maxHeadlineLength = 60,
      includeVariants = true,
    } = input;

    await this.logProgress('Analyzing brand messaging...', 10);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(tone, maxHeadlineLength);

    // Build user message
    const userMessage = this.buildUserMessage(businessRequirements, includeVariants);

    // Send to Claude
    await this.logProgress('Generating hero copy...', 30);

    const response = await this.sendMessage(
      [createUserMessage(userMessage)],
      systemPrompt,
      {
        temperature: 0.8, // Higher creativity for copywriting
      }
    );

    await this.logProgress('Processing copy variations...', 70);

    // Parse response
    const output = this.parseResponse(response.text);

    // Save to database
    await this.saveToDatabase(output);

    await this.logProgress('Hero copy generation complete', 100);

    return {
      output,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: response.usage.cost?.totalCost,
    };
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(tone: string, maxHeadlineLength: number): string {
    return `You are an expert copywriter specializing in high-converting hero section content.

Your task is to create compelling hero copy that:
1. Immediately captures attention
2. Clearly communicates the value proposition
3. Speaks directly to the target audience's needs
4. Creates emotional resonance
5. Drives action with strong CTAs
6. Is optimized for SEO

Tone: ${tone}
Maximum headline length: ${maxHeadlineLength} characters

Best practices:
- Start with a benefit, not a feature
- Use power words that evoke emotion
- Be specific and concrete, not vague
- Focus on the transformation/outcome
- Create urgency without being pushy
- Use active voice and strong verbs

Output your copy as a valid JSON object with the following structure:
{
  "headline": "compelling, benefit-focused headline",
  "subheadline": "supporting text that expands on the headline",
  "ctaPrimary": {
    "text": "action-oriented button text",
    "action": "what happens when clicked (e.g., 'navigate to contact form')"
  },
  "ctaSecondary": {
    "text": "optional secondary CTA",
    "action": "secondary action"
  },
  "supportingText": "optional additional text below the subheadline",
  "variants": [
    {
      "headline": "alternative headline",
      "subheadline": "alternative subheadline",
      "reasoning": "why this variant might work better for certain audiences"
    }
  ],
  "seoKeywords": ["keyword1", "keyword2", "keyword3"],
  "rationale": "Explain your copywriting choices and strategy"
}`;
  }

  /**
   * Build user message
   */
  private buildUserMessage(businessRequirements: any, includeVariants: boolean): string {
    let message = `Create compelling hero section copy for the following business:\n\n`;

    message += `## Company Information\n`;
    message += `Company: ${businessRequirements.companyName}\n`;
    message += `Industry: ${businessRequirements.industry}\n`;
    message += `Target Audience: ${businessRequirements.targetAudience}\n\n`;

    if (businessRequirements.primaryGoals && businessRequirements.primaryGoals.length > 0) {
      message += `## Primary Goals\n`;
      businessRequirements.primaryGoals.forEach((goal: string) => {
        message += `- ${goal}\n`;
      });
      message += `\n`;
    }

    if (businessRequirements.valuePropositions && businessRequirements.valuePropositions.length > 0) {
      message += `## Value Propositions\n`;
      businessRequirements.valuePropositions.forEach((vp: string) => {
        message += `- ${vp}\n`;
      });
      message += `\n`;
    }

    if (businessRequirements.keyMessages && businessRequirements.keyMessages.length > 0) {
      message += `## Key Messages\n`;
      businessRequirements.keyMessages.forEach((msg: string) => {
        message += `- ${msg}\n`;
      });
      message += `\n`;
    }

    if (businessRequirements.competitiveAdvantages && businessRequirements.competitiveAdvantages.length > 0) {
      message += `## Competitive Advantages\n`;
      businessRequirements.competitiveAdvantages.forEach((adv: string) => {
        message += `- ${adv}\n`;
      });
      message += `\n`;
    }

    if (includeVariants) {
      message += `Please provide 3 alternative headline/subheadline variants for A/B testing.\n\n`;
    }

    message += `Provide the hero copy as a JSON object.`;

    return message;
  }

  /**
   * Parse Claude response
   */
  private parseResponse(text: string): HeroCopyOutput {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    return {
      headline: parsed.headline || 'Transform Your Business Today',
      subheadline: parsed.subheadline || 'Discover the power of our solution',
      ctaPrimary: parsed.ctaPrimary || { text: 'Get Started', action: 'navigate to signup' },
      ctaSecondary: parsed.ctaSecondary,
      supportingText: parsed.supportingText,
      variants: parsed.variants || [],
      seoKeywords: parsed.seoKeywords || [],
      rationale: parsed.rationale || 'Hero copy designed for maximum conversion.',
    };
  }

  /**
   * Save output to database
   */
  private async saveToDatabase(output: HeroCopyOutput): Promise<void> {
    // Save as generated asset
    await this.prisma.generatedAsset.create({
      data: {
        projectId: this.context.projectId,
        tenantId: this.context.tenantId,
        type: 'COPY',
        category: 'HERO',
        name: 'Hero Section Copy',
        content: output as any,
        metadata: {
          agentRole: this.getAgentRole(),
          agentExecutionId: this.context.agentExecutionId,
          seoKeywords: output.seoKeywords,
        } as any,
      },
    });
  }
}
