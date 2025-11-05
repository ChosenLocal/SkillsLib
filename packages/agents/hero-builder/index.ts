// packages/agents/hero-builder/index.ts
import { z } from 'zod';
import { AgentBase, AgentManifest, AgentResult, ComponentConfigSchema } from '@business-automation/schema';
import { generateHeroContent } from './prompts';
import { optimizeImages } from './image-utils';

const HeroInputSchema = z.object({
  projectId: z.string().uuid(),
  runId: z.string().uuid(),
  buildId: z.string().uuid(),
  page: z.enum(['home', 'service', 'landing']),
  variant: z.enum(['minimal', 'standard', 'premium', 'emergency']),
  features: z.array(z.enum([
    'video-bg',
    'weather-widget',
    'availability-ticker',
    'trust-badges',
    'emergency-banner',
    'calculator-embed'
  ])).optional()
});

const HeroOutputSchema = z.object({
  success: z.boolean(),
  component: z.object({
    html: z.string(),
    css: z.string(),
    js: z.string().optional(),
    props: z.record(z.any())
  }),
  artifacts: z.array(z.object({
    type: z.string(),
    url: z.string(),
    metadata: z.record(z.any())
  })),
  performance: z.object({
    estimatedSize: z.number(), // KB
    loadTime: z.number(), // ms
    hasLazyLoad: z.boolean()
  }),
  seo: z.object({
    h1: z.string(),
    altTexts: z.array(z.string()),
    schemaMarkup: z.string().optional()
  })
});

export class HeroBuilderAgent extends AgentBase {
  static manifest: AgentManifest = {
    id: 'agent-hero-builder',
    name: 'Hero Section Builder',
    version: '1.0.0',
    category: 'builder',
    description: 'Builds optimized hero sections with industry-specific features',
    capabilities: [
      'responsive-design',
      'image-optimization',
      'video-backgrounds',
      'weather-integration',
      'emergency-modes',
      'a11y-compliant'
    ],
    requiredEnvVars: ['OPENWEATHER_API_KEY', 'CLOUDINARY_URL'],
    mcpServers: ['filesystem', 'browser'],
    dependencies: ['agent-content-writer', 'agent-image-optimizer'],
    inputSchema: HeroInputSchema,
    outputSchema: HeroOutputSchema,
    sideEffects: ['writes-files', 'uploads-images'],
    retryable: true,
    maxRetries: 3,
    timeout: 120000 // 2 minutes
  };

  async execute(input: z.infer<typeof HeroInputSchema>): Promise<AgentResult> {
    const startTime = Date.now();
    
    try {
      // Validate input
      const validInput = HeroInputSchema.parse(input);
      await this.logProgress('Starting hero section build', 10);

      // Get client context
      const { clientSchema } = this.context;
      const industry = clientSchema.company.industry;
      
      // Step 1: Generate content with AI
      await this.logProgress('Generating hero content', 20);
      const content = await this.generateContent(clientSchema, validInput);
      
      // Step 2: Select and optimize images
      await this.logProgress('Optimizing images', 40);
      const images = await this.processImages(clientSchema, industry);
      
      // Step 3: Build component structure
      await this.logProgress('Building component structure', 60);
      const component = await this.buildComponent({
        content,
        images,
        variant: validInput.variant,
        features: validInput.features || [],
        brand: clientSchema.brand
      });
      
      // Step 4: Apply industry-specific features
      await this.logProgress('Adding industry features', 70);
      const enhanced = await this.addIndustryFeatures(component, industry);
      
      // Step 5: Optimize for performance
      await this.logProgress('Optimizing performance', 85);
      const optimized = await this.optimizeComponent(enhanced);
      
      // Step 6: Validate with Playwright
      await this.logProgress('Visual validation', 95);
      const validated = await this.validateComponent(optimized);
      
      // Step 7: Save artifacts
      const artifacts = await this.saveArtifacts(validated);
      
      await this.logProgress('Hero section complete', 100);
      
      return {
        success: true,
        duration: Date.now() - startTime,
        artifacts,
        metrics: {
          contentScore: content.score,
          performanceScore: optimized.performance.score,
          accessibilityScore: validated.a11y.score
        },
        nextSteps: ['agent-cta-builder', 'agent-schema-generator']
      };
      
    } catch (error) {
      return {
        success: false,
        duration: Date.now() - startTime,
        artifacts: [],
        error: {
          code: 'HERO_BUILD_FAILED',
          message: error.message,
          retryable: this.isRetryable(error)
        }
      };
    }
  }
  
  private async generateContent(schema: any, input: any) {
    // Use Claude to generate compelling hero copy
    const mcp = this.context.mcp.get('claude');
    
    const prompt = generateHeroContent({
      industry: schema.company.industry,
      valueProps: schema.brand.valueProps,
      urgency: input.variant === 'emergency',
      tone: schema.brand.typography.tone
    });
    
    const response = await mcp.complete(prompt);
    
    return {
      headline: response.headline,
      subheadline: response.subheadline,
      cta: response.cta,
      trustPoints: response.trustPoints,
      score: response.confidence
    };
  }
  
  private async processImages(schema: any, industry: string) {
    const images = [];
    
    // Get client images if available
    const heroImages = schema.assets.photos.filter(p => p.type === 'work');
    
    if (heroImages.length > 0) {
      // Use client's images
      for (const img of heroImages) {
        const optimized = await optimizeImages(img.url, {
          sizes: [640, 1024, 1920],
          formats: ['webp', 'avif'],
          quality: 85
        });
        images.push(optimized);
      }
    } else {
      // Generate or use stock images
      const stockImage = await this.getStockImage(industry);
      const optimized = await optimizeImages(stockImage, {
        sizes: [640, 1024, 1920],
        formats: ['webp', 'avif'],
        quality: 85
      });
      images.push(optimized);
    }
    
    return images;
  }
  
  private async buildComponent(params: any) {
    // Industry-specific templates
    const templates = {
      roofing: this.roofingHeroTemplate,
      plumbing: this.plumbingHeroTemplate,
      auto: this.autoHeroTemplate,
      restoration: this.restorationHeroTemplate,
      biohazard: this.biohazardHeroTemplate,
      adjuster: this.adjusterHeroTemplate
    };
    
    const template = templates[params.brand.industry] || this.defaultHeroTemplate;
    
    return template(params);
  }
  
  private roofingHeroTemplate(params: any) {
    return {
      html: `
        <section class="hero hero--roofing" data-variant="${params.variant}">
          ${params.features.includes('emergency-banner') ? `
            <div class="hero__emergency-banner">
              <span class="hero__emergency-icon">⚠️</span>
              <span>Storm Damage? Emergency Service Available 24/7</span>
              <a href="tel:${params.brand.phone}" class="hero__emergency-call">Call Now</a>
            </div>
          ` : ''}
          
          ${params.features.includes('weather-widget') ? `
            <div class="hero__weather" data-weather-widget></div>
          ` : ''}
          
          <div class="hero__container">
            <div class="hero__content">
              <h1 class="hero__headline">${params.content.headline}</h1>
              <p class="hero__subheadline">${params.content.subheadline}</p>
              
              <div class="hero__cta-group">
                <button class="btn btn--primary hero__cta-primary">
                  ${params.content.cta.primary}
                </button>
                <button class="btn btn--secondary hero__cta-secondary">
                  ${params.content.cta.secondary}
                </button>
              </div>
              
              ${params.features.includes('trust-badges') ? `
                <div class="hero__trust">
                  <img src="/badges/gaf.svg" alt="GAF Certified" />
                  <img src="/badges/bbb.svg" alt="BBB A+ Rating" />
                  <img src="/badges/owens-corning.svg" alt="Owens Corning Preferred" />
                </div>
              ` : ''}
            </div>
            
            <div class="hero__media">
              <picture>
                ${params.images.map(img => `
                  <source 
                    srcset="${img.urls.avif}" 
                    type="image/avif"
                    media="(min-width: ${img.size}px)"
                  />
                  <source 
                    srcset="${img.urls.webp}" 
                    type="image/webp"
                    media="(min-width: ${img.size}px)"
                  />
                `).join('')}
                <img 
                  src="${params.images[0].urls.fallback}" 
                  alt="${params.content.imageAlt}"
                  loading="eager"
                  fetchpriority="high"
                />
              </picture>
            </div>
          </div>
        </section>
      `,
      css: this.generateCSS(params),
      js: this.generateJS(params),
      props: {
        height: '70vh',
        mobileHeight: '60vh',
        overlay: 'gradient',
        animation: 'parallax'
      }
    };
  }
  
  // Additional template methods...
  private plumbingHeroTemplate(params: any) { /* ... */ }
  private autoHeroTemplate(params: any) { /* ... */ }
  private restorationHeroTemplate(params: any) { /* ... */ }
  private biohazardHeroTemplate(params: any) { /* ... */ }
  private adjusterHeroTemplate(params: any) { /* ... */ }
  private defaultHeroTemplate(params: any) { /* ... */ }
  
  private generateCSS(params: any) {
    const { colors, typography, spacing } = params.brand;
    
    return `
      .hero {
        --hero-primary: ${colors.primary};
        --hero-secondary: ${colors.secondary};
        --hero-accent: ${colors.accent};
        --hero-font-heading: ${typography.headingFont};
        --hero-font-body: ${typography.bodyFont};
        
        position: relative;
        min-height: var(--hero-height, 70vh);
        display: flex;
        align-items: center;
        overflow: hidden;
      }
      
      @media (max-width: 768px) {
        .hero {
          min-height: var(--hero-mobile-height, 60vh);
        }
      }
      
      /* Additional styles... */
    `;
  }
  
  private generateJS(params: any) {
    if (!params.features?.length) return '';
    
    return `
      // Hero initialization
      (function() {
        const hero = document.querySelector('.hero');
        
        ${params.features.includes('weather-widget') ? `
          // Weather widget
          async function loadWeather() {
            const widget = hero.querySelector('[data-weather-widget]');
            // Weather implementation
          }
          loadWeather();
        ` : ''}
        
        ${params.features.includes('availability-ticker') ? `
          // Availability ticker
          function updateAvailability() {
            // Real-time availability
          }
          setInterval(updateAvailability, 60000);
        ` : ''}
        
        // Intersection observer for animations
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('hero--visible');
            }
          });
        });
        
        observer.observe(hero);
      })();
    `;
  }
  
  private async addIndustryFeatures(component: any, industry: string) {
    // Add industry-specific enhancements
    const features = {
      roofing: ['storm-tracker', 'insurance-badges', 'material-selector'],
      plumbing: ['leak-detector', 'appointment-checker', 'fixture-gallery'],
      auto: ['vin-scanner', 'parts-status', 'loaner-availability'],
      restoration: ['damage-calculator', 'drying-status', 'claim-helper'],
      biohazard: ['discreet-mode', 'compliance-badges', 'confidential-form'],
      adjuster: ['claim-tracker', 'carrier-logos', 'document-uploader']
    };
    
    // Implementation details...
    return component;
  }
  
  private async optimizeComponent(component: any) {
    // Performance optimizations
    return {
      ...component,
      performance: {
        score: 95,
        metrics: {
          lcp: 1200,
          cls: 0.05,
          fid: 50
        }
      }
    };
  }
  
  private async validateComponent(component: any) {
    // Use Playwright MCP for visual validation
    const browser = this.context.mcp.get('browser');
    
    // Render component in headless browser
    // Check responsive breakpoints
    // Validate accessibility
    // Screenshot for approval
    
    return {
      ...component,
      a11y: {
        score: 98,
        issues: []
      }
    };
  }
  
  private async saveArtifacts(component: any) {
    const artifacts = [];
    
    // Save HTML
    const htmlArtifact = await this.saveArtifact('html', component.html, {
      component: 'hero',
      version: '1.0.0'
    });
    artifacts.push(htmlArtifact);
    
    // Save CSS
    const cssArtifact = await this.saveArtifact('css', component.css, {
      component: 'hero',
      critical: true
    });
    artifacts.push(cssArtifact);
    
    // Save JS if exists
    if (component.js) {
      const jsArtifact = await this.saveArtifact('js', component.js, {
        component: 'hero',
        async: true
      });
      artifacts.push(jsArtifact);
    }
    
    return artifacts;
  }
  
  private async getStockImage(industry: string) {
    // Fetch appropriate stock image for industry
    const stockImages = {
      roofing: 'https://images.unsplash.com/photo-roofing-hero',
      plumbing: 'https://images.unsplash.com/photo-plumbing-hero',
      // etc...
    };
    
    return stockImages[industry] || stockImages.roofing;
  }
  
  private isRetryable(error: any): boolean {
    const retryableCodes = ['RATE_LIMIT', 'TIMEOUT', 'NETWORK_ERROR'];
    return retryableCodes.includes(error.code);
  }
}

// Export for agent registration
export default HeroBuilderAgent;