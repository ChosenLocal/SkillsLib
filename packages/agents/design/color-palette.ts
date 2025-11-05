import { AgentRole, AgentLayer } from '@business-automation/database';
import type { AgentManifest, AgentResult } from '@business-automation/schema';
import { BaseAgent, type ExtendedAgentContext, type AgentConfig } from '../shared/base-agent';
import { createUserMessage } from '../shared/claude-client';

/**
 * Color definition
 */
export interface Color {
  name: string;
  hex: string;
  rgb: string;
  usage: string;
}

/**
 * Color palette output schema
 */
export interface ColorPaletteOutput {
  primary: Color;
  secondary: Color;
  accent: Color;
  neutrals: Color[];
  semantic: {
    success: Color;
    warning: Color;
    error: Color;
    info: Color;
  };
  gradients?: Array<{
    name: string;
    colors: string[];
    direction: string;
  }>;
  rationale: string;
}

/**
 * ColorPalette Agent
 *
 * Generates a comprehensive color palette based on brand attributes,
 * industry, and target audience.
 */
export class ColorPaletteAgent extends BaseAgent {
  static manifest: AgentManifest = {
    role: 'COLOR_PALETTE' as AgentRole,
    layer: 'DESIGN' as AgentLayer,
    name: 'Color Palette Generator',
    description:
      'Generates a comprehensive, accessible color palette based on brand attributes and industry context',
    version: '1.0.0',
    dependencies: ['BUSINESS_REQUIREMENTS'],
    inputs: {
      type: 'object',
      properties: {
        businessRequirements: { type: 'object' },
        brandColors: { type: 'array' },
        accessibilityLevel: { type: 'string', enum: ['AA', 'AAA'] },
      },
      required: ['businessRequirements'],
    },
    outputs: {
      type: 'object',
      properties: {
        primary: { type: 'object' },
        secondary: { type: 'object' },
        accent: { type: 'object' },
        neutrals: { type: 'array' },
        semantic: { type: 'object' },
        gradients: { type: 'array' },
        rationale: { type: 'string' },
      },
    },
  };

  constructor(context: ExtendedAgentContext, config?: AgentConfig) {
    super(context, config);
  }

  protected getAgentRole(): AgentRole {
    return 'COLOR_PALETTE';
  }

  protected getAgentLayer(): AgentLayer {
    return 'DESIGN';
  }

  /**
   * Execute color palette generation
   */
  protected async execute(input: any): Promise<AgentResult> {
    const { businessRequirements, brandColors, accessibilityLevel = 'AA' } = input;

    await this.logProgress('Analyzing brand attributes...', 10);

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(accessibilityLevel);

    // Build user message
    const userMessage = this.buildUserMessage(businessRequirements, brandColors);

    // Send to Claude
    await this.logProgress('Generating color palette...', 30);

    const response = await this.sendMessage(
      [createUserMessage(userMessage)],
      systemPrompt,
      {
        temperature: 0.7, // Medium creativity for design
      }
    );

    await this.logProgress('Processing color palette...', 70);

    // Parse response
    const output = this.parseResponse(response.text);

    // Save to database
    await this.saveToDatabase(output);

    await this.logProgress('Color palette generation complete', 100);

    return {
      output,
      tokensUsed: response.usage.inputTokens + response.usage.outputTokens,
      cost: response.usage.cost?.totalCost,
    };
  }

  /**
   * Build system prompt
   */
  private buildSystemPrompt(accessibilityLevel: string): string {
    return `You are an expert brand designer specializing in color theory and accessible design.

Your task is to create a comprehensive, harmonious color palette that:
1. Reflects the brand's attributes and industry
2. Appeals to the target audience
3. Meets WCAG ${accessibilityLevel} accessibility standards
4. Provides sufficient contrast for readability
5. Creates the right emotional impact
6. Is versatile for various UI elements

Consider:
- Color psychology and emotional associations
- Industry conventions and expectations
- Cultural implications of colors
- Accessibility and contrast ratios
- Digital display optimization (RGB/HEX)

Output your palette as a valid JSON object with the following structure:
{
  "primary": {
    "name": "descriptive name",
    "hex": "#RRGGBB",
    "rgb": "rgb(R, G, B)",
    "usage": "where and how to use this color"
  },
  "secondary": { /* same structure */ },
  "accent": { /* same structure */ },
  "neutrals": [
    { "name": "Light Gray", "hex": "#...", "rgb": "...", "usage": "backgrounds, borders" },
    { "name": "Medium Gray", "hex": "#...", "rgb": "...", "usage": "secondary text" },
    { "name": "Dark Gray", "hex": "#...", "rgb": "...", "usage": "primary text" }
  ],
  "semantic": {
    "success": { /* same structure */ },
    "warning": { /* same structure */ },
    "error": { /* same structure */ },
    "info": { /* same structure */ }
  },
  "gradients": [
    {
      "name": "Primary Gradient",
      "colors": ["#...", "#..."],
      "direction": "to right"
    }
  ],
  "rationale": "Explain your color choices and how they support the brand"
}

Ensure all colors meet ${accessibilityLevel} contrast requirements.`;
  }

  /**
   * Build user message
   */
  private buildUserMessage(businessRequirements: any, brandColors?: string[]): string {
    let message = `Create a comprehensive color palette for the following brand:\n\n`;

    message += `## Brand Information\n`;
    message += `Company: ${businessRequirements.companyName}\n`;
    message += `Industry: ${businessRequirements.industry}\n`;
    message += `Target Audience: ${businessRequirements.targetAudience}\n\n`;

    if (businessRequirements.brandAttributes && businessRequirements.brandAttributes.length > 0) {
      message += `## Brand Attributes\n`;
      businessRequirements.brandAttributes.forEach((attr: string) => {
        message += `- ${attr}\n`;
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

    if (brandColors && brandColors.length > 0) {
      message += `## Existing Brand Colors (to incorporate or build upon)\n`;
      brandColors.forEach((color) => {
        message += `- ${color}\n`;
      });
      message += `\n`;
    }

    message += `Please provide a complete, accessible color palette as a JSON object.`;

    return message;
  }

  /**
   * Parse Claude response
   */
  private parseResponse(text: string): ColorPaletteOutput {
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to extract JSON from response');
    }

    const jsonText = jsonMatch[1] || jsonMatch[0];
    const parsed = JSON.parse(jsonText);

    return {
      primary: parsed.primary || { name: 'Primary', hex: '#0066CC', rgb: 'rgb(0, 102, 204)', usage: 'Main brand color' },
      secondary: parsed.secondary || { name: 'Secondary', hex: '#6C757D', rgb: 'rgb(108, 117, 125)', usage: 'Supporting color' },
      accent: parsed.accent || { name: 'Accent', hex: '#FF6B35', rgb: 'rgb(255, 107, 53)', usage: 'CTAs and highlights' },
      neutrals: parsed.neutrals || [],
      semantic: parsed.semantic || {
        success: { name: 'Success', hex: '#28A745', rgb: 'rgb(40, 167, 69)', usage: 'Success messages' },
        warning: { name: 'Warning', hex: '#FFC107', rgb: 'rgb(255, 193, 7)', usage: 'Warnings' },
        error: { name: 'Error', hex: '#DC3545', rgb: 'rgb(220, 53, 69)', usage: 'Errors' },
        info: { name: 'Info', hex: '#17A2B8', rgb: 'rgb(23, 162, 184)', usage: 'Information' },
      },
      gradients: parsed.gradients,
      rationale: parsed.rationale || 'Color palette designed for optimal brand representation.',
    };
  }

  /**
   * Save output to database
   */
  private async saveToDatabase(output: ColorPaletteOutput): Promise<void> {
    // Create or update design system with color palette
    await this.prisma.designSystem.upsert({
      where: {
        projectId_version: {
          projectId: this.context.projectId,
          version: '1.0.0',
        },
      },
      create: {
        projectId: this.context.projectId,
        tenantId: this.context.tenantId,
        version: '1.0.0',
        colorPalette: output as any,
      },
      update: {
        colorPalette: output as any,
      },
    });
  }
}
