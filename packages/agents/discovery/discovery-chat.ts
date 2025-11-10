/**
 * Discovery Chat Agent
 *
 * Conversational AI agent for collecting comprehensive client profile data.
 * Uses Claude to guide users through filling out the ClientProfileSchema
 * through natural conversation.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ClientProfileSchema } from '@business-automation/schema';

/**
 * Message in conversation history
 */
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Result from Discovery Chat agent
 */
export interface DiscoveryChatResult {
  response: string;
  extractedData: Record<string, any>;
  completeness: number; // 0-100
}

/**
 * Discovery Chat Agent
 * Handles conversational schema collection
 */
export class DiscoveryChatAgent {
  private anthropic: Anthropic;
  private model = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Process a user message and generate AI response with schema extraction
   */
  async chat(
    messages: Message[],
    existingData: Record<string, any> = {}
  ): Promise<DiscoveryChatResult> {
    // Build system prompt with schema context
    const systemPrompt = this.buildSystemPrompt(existingData);

    // Convert messages to Anthropic format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Call Claude
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2000,
      temperature: 0.7, // Conversational but focused
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const responseText = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // Extract schema data from the conversation
    const extractedData = await this.extractSchemaData(messages, responseText, existingData);

    // Calculate completeness
    const completeness = this.calculateCompleteness(extractedData);

    return {
      response: responseText,
      extractedData,
      completeness,
    };
  }

  /**
   * Build system prompt with context about the schema and current progress
   */
  private buildSystemPrompt(existingData: Record<string, any>): string {
    const completedSections = this.getCompletedSections(existingData);
    const missingSections = this.getMissingSections(existingData);

    return `You are a friendly and professional business consultant helping a client build a comprehensive profile for their website project.

# Your Goal
Guide the conversation to collect all information needed for the ClientProfileSchema, which includes:

## 12 Major Sections:
1. **Company** - Legal info, basic details, industry, size, financial info
2. **Brand** - Positioning, voice, visual identity, assets
3. **Offerings** - Services, products, packages, pricing, delivery, guarantees
4. **Audience** - Segments, personas, journey, psychographics, behavior
5. **Marketing** - Campaigns, channels, content, messaging, conversion strategies
6. **Team** - Leadership, departments, culture, expertise
7. **Credibility** - Testimonials, case studies, portfolio, reviews, awards
8. **Website** - Goals, structure, pages, features, design preferences, technical requirements
9. **Support** - Channels, resources, SLA, policies
10. **Locations** - Physical locations, service areas
11. **Local SEO** - Local search, community involvement, competition
12. **Compliance** - Licenses, permits, data protection, industry regulations

# Current Progress
${completedSections.length > 0 ? `✓ Completed: ${completedSections.join(', ')}` : 'Just getting started!'}
${missingSections.length > 0 ? `○ Remaining: ${missingSections.slice(0, 5).join(', ')}${missingSections.length > 5 ? '...' : ''}` : 'All sections covered!'}

# Conversation Style
- Be warm and conversational, not robotic
- Ask 2-3 questions at a time (don't overwhelm)
- Use follow-up questions to dig deeper
- Acknowledge and validate their responses
- Use industry-specific language when appropriate
- If they're unsure about something, that's okay - move on and come back later

# Progressive Disclosure Strategy
- Start with the basics (company name, industry, what they do)
- Then move to their offerings (services/products)
- Then brand and audience
- Save technical details and compliance for later

# Response Format
Just respond naturally - don't output JSON or structured data in your response.
Your response should be a natural, conversational message with 2-3 questions.

# Example Exchanges
User: "We're a roofing company called ABC Roofing"
Assistant: "Great! ABC Roofing - I like it. How long have you been in business, and what areas do you primarily serve? Also, what types of roofing projects are you known for - residential, commercial, or both?"

User: "About 15 years, mostly residential in the Phoenix metro area"
Assistant: "Excellent, 15 years is a solid track record! That local experience in Phoenix really matters. Now, tell me about your target customers - who typically reaches out to you? Are they homeowners dealing with storm damage, people looking for upgrades, or folks building new homes?"

Remember: Be helpful, be human, and help them tell their story!`;
  }

  /**
   * Extract structured schema data from the conversation
   */
  private async extractSchemaData(
    messages: Message[],
    latestResponse: string,
    existingData: Record<string, any>
  ): Promise<Record<string, any>> {
    // Get the last few messages for context
    const recentMessages = messages.slice(-4); // Last 4 messages

    // Build extraction prompt
    const extractionPrompt = `Analyze this conversation and extract structured data that fits the ClientProfileSchema.

Recent conversation:
${recentMessages.map((m) => `${m.role}: ${m.content}`).join('\n\n')}

Latest assistant response:
${latestResponse}

Current extracted data:
${JSON.stringify(existingData, null, 2)}

Based on this conversation, extract any NEW information and merge it with the existing data. Output ONLY a valid JSON object with the updated/extracted fields. Use the ClientProfileSchema structure:

{
  "company": { "name": "", "legalName": "", "industry": "", "founded": "", ... },
  "brand": { "tagline": "", "positioning": "", "voice": { "tone": [], "personality": [] }, ... },
  "offerings": { "services": [], "products": [], ... },
  "audience": { "segments": [], ... },
  "marketing": { ... },
  "team": { ... },
  "credibility": { ... },
  "website": { ... },
  "support": { ... },
  "locations": [],
  "local": { ... },
  "compliance": { ... }
}

Only include sections that have NEW data. Merge with existing data. Be specific and extract real values, not placeholders.`;

    // Call Claude for extraction
    const extractionResponse = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4000,
      temperature: 0.3, // Lower temp for structured extraction
      messages: [
        {
          role: 'user',
          content: extractionPrompt,
        },
      ],
    });

    const extractedText = extractionResponse.content[0].type === 'text'
      ? extractionResponse.content[0].text
      : '{}';

    // Parse JSON from response
    const jsonMatch = extractedText.match(/```json\n([\s\S]*?)\n```/) || extractedText.match(/\{[\s\S]*\}/);
    const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : '{}';

    let newData: Record<string, any>;
    try {
      newData = JSON.parse(jsonText);
    } catch (error) {
      console.error('Failed to parse extracted data:', error);
      newData = {};
    }

    // Deep merge with existing data
    return this.deepMerge(existingData, newData);
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        output[key] = this.deepMerge(target[key] || {}, source[key]);
      } else if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        output[key] = source[key];
      }
    }

    return output;
  }

  /**
   * Calculate completeness percentage (0-100)
   */
  private calculateCompleteness(data: Record<string, any>): number {
    const sections = [
      'company',
      'brand',
      'offerings',
      'audience',
      'marketing',
      'team',
      'credibility',
      'website',
      'support',
      'locations',
      'local',
      'compliance',
    ];

    let filledSections = 0;
    let totalWeight = 0;

    sections.forEach((section) => {
      const sectionData = data[section];
      if (!sectionData) return;

      // Calculate how "filled" this section is
      const filled = this.getSectionFillPercentage(sectionData);
      if (filled > 0.2) {
        // Count as filled if > 20% of fields have data
        filledSections += filled;
      }
      totalWeight += 1;
    });

    return Math.round((filledSections / totalWeight) * 100);
  }

  /**
   * Get percentage of fields filled in a section (0-1)
   */
  private getSectionFillPercentage(section: any): number {
    if (!section || typeof section !== 'object') return 0;

    let totalFields = 0;
    let filledFields = 0;

    const countFields = (obj: any): void => {
      for (const value of Object.values(obj)) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          countFields(value);
        } else {
          totalFields++;
          if (value && (Array.isArray(value) ? value.length > 0 : true)) {
            filledFields++;
          }
        }
      }
    };

    countFields(section);

    return totalFields > 0 ? filledFields / totalFields : 0;
  }

  /**
   * Get list of completed sections
   */
  private getCompletedSections(data: Record<string, any>): string[] {
    const sections = ['company', 'brand', 'offerings', 'audience', 'marketing', 'team', 'credibility', 'website', 'support', 'locations', 'local', 'compliance'];
    return sections.filter((section) => {
      const filled = this.getSectionFillPercentage(data[section]);
      return filled > 0.5; // >50% filled counts as "completed"
    });
  }

  /**
   * Get list of missing sections
   */
  private getMissingSections(data: Record<string, any>): string[] {
    const sections = ['company', 'brand', 'offerings', 'audience', 'marketing', 'team', 'credibility', 'website', 'support', 'locations', 'local', 'compliance'];
    return sections.filter((section) => {
      const filled = this.getSectionFillPercentage(data[section]);
      return filled <= 0.5; // <=50% filled counts as "missing"
    });
  }
}
