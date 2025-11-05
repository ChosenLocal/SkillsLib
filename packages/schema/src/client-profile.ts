import { z } from 'zod';
import {
  AddressSchema,
  AssetSchema,
  AvailabilityScheduleSchema,
  AwardSchema,
  CaseStudySchema,
  CertificationSchema,
  ColorSchema,
  CompetitorSchema,
  CustomerSegmentSchema,
  DepartmentSchema,
  FontSchema,
  FormRequirementSchema,
  GradientSchema,
  IntegrationSchema,
  KPISchema,
  LocationSchema,
  PackageSchema,
  PaymentMethodSchema,
  PersonaSchema,
  PortfolioItemSchema,
  ProductSchema,
  SEORequirementsSchema,
  ServiceSchema,
  TeamMemberSchema,
  TestimonialSchema,
} from './client-profile-types';

/**
 * Comprehensive Client Profile Schema
 * Enterprise-grade schema for contractor businesses covering all aspects
 * from legal/financial to brand identity, marketing, and compliance
 */

// ==================== CORE IDENTIFICATION ====================

// Note: Core identification fields are inlined in ClientProfileSchema
// const CoreIdentificationSchema = z.object({
//   id: z.string().uuid(),
//   version: z.string().describe('Schema version for migrations'),
//   createdAt: z.date(),
//   updatedAt: z.date(),
//   lastSyncedAt: z.date(),
// });

// ==================== COMPANY FUNDAMENTALS ====================

const CompanyLegalSchema = z.object({
  legalName: z.string(),
  dba: z.array(z.string()).default([]),
  entityType: z.enum(['LLC', 'Corporation', 'SCorp', 'Partnership', 'SoleProprietorship']),
  ein: z.string(),
  stateOfIncorporation: z.string(),
  dateIncorporated: z.date(),
  registrationNumbers: z.record(z.string()).describe('State licenses, etc.'),
});

const CompanyBasicSchema = z.object({
  founded: z.date(),
  headquarters: AddressSchema,
  website: z.object({
    current: z.string().url(),
    previous: z.array(z.string().url()).default([]),
    competitors: z.array(z.string().url()).default([]),
  }),
  phone: z.object({
    main: z.string(),
    support: z.string().optional(),
    sales: z.string().optional(),
    emergency: z.string().optional(),
  }),
  email: z.object({
    general: z.string().email(),
    support: z.string().email().optional(),
    sales: z.string().email().optional(),
    careers: z.string().email().optional(),
  }),
});

const CompanyIndustrySchema = z.object({
  primary: z.string().describe('NAICS code'),
  secondary: z.array(z.string()).default([]),
  verticals: z.array(z.string()).default([]),
  specializations: z.array(z.string()).default([]),
  certifiedIn: z.array(z.string()).default([]),
  associations: z.array(z.string()).default([]),
  regulatoryBodies: z.array(z.string()).default([]),
});

const CompanySizeSchema = z.object({
  employees: z.object({
    total: z.number(),
    fullTime: z.number(),
    contractors: z.number(),
    ranges: z.object({
      display: z.enum(['1-10', '11-50', '51-200', '201-500', '500+']),
    }),
  }),
  revenue: z.object({
    annual: z.number(),
    currency: z.string().default('USD'),
    range: z.object({ min: z.number(), max: z.number() }),
    growthRate: z.number().describe('YoY percentage'),
  }),
  locations: z.number(),
  serviceArea: z.object({
    type: z.enum(['local', 'regional', 'national', 'international']),
    radius: z.number().optional(),
    states: z.array(z.string()).optional(),
    countries: z.array(z.string()).optional(),
    metros: z.array(z.string()).optional(),
    zips: z.array(z.string()).optional(),
  }),
});

const CompanyFinancialSchema = z.object({
  acceptedPayments: z.array(PaymentMethodSchema),
  paymentTerms: z.string(),
  financing: z.object({
    offers: z.boolean(),
    partners: z.array(z.string()).default([]),
    terms: z.array(z.string()).default([]),
  }),
  insurance: z.object({
    generalLiability: z.boolean(),
    professionalLiability: z.boolean(),
    workersComp: z.boolean(),
    bonded: z.boolean(),
    coverageAmounts: z.record(z.number()),
  }),
  warranties: z.object({
    standard: z.string(),
    extended: z.array(z.string()).default([]),
    guarantees: z.array(z.string()).default([]),
  }),
});

const CompanySchema = z.object({
  legal: CompanyLegalSchema,
  basic: CompanyBasicSchema,
  industry: CompanyIndustrySchema,
  size: CompanySizeSchema,
  financial: CompanyFinancialSchema,
});

// ==================== BRAND IDENTITY ====================

const BrandPositioningSchema = z.object({
  mission: z.string(),
  vision: z.string(),
  values: z.array(z.string()),
  tagline: z.string(),
  elevatorPitch: z.string(),
  uniqueValueProposition: z.string(),
  differentiators: z.array(z.string()),
  personalityTraits: z.array(z.string()),
});

const BrandVoiceSchema = z.object({
  tone: z.enum(['professional', 'casual', 'friendly', 'authoritative', 'playful']),
  perspective: z.enum(['first-person', 'second-person', 'third-person']),
  vocabulary: z.enum(['simple', 'moderate', 'technical', 'industry-specific']),
  style: z.object({
    humor: z.enum(['none', 'subtle', 'moderate', 'prominent']),
    formality: z.enum(['very-formal', 'formal', 'semi-formal', 'casual']),
    enthusiasm: z.enum(['reserved', 'moderate', 'enthusiastic', 'high-energy']),
  }),
  doWords: z.array(z.string()).describe('Words/phrases to use'),
  dontWords: z.array(z.string()).describe('Words/phrases to avoid'),
  examplePhrases: z.array(z.string()),
});

const BrandVisualSchema = z.object({
  logo: z.object({
    primary: AssetSchema,
    variations: z.array(AssetSchema),
    clearSpace: z.number().describe('Minimum padding in px'),
    minimumSize: z.object({ width: z.number(), height: z.number() }),
    usage: z.array(z.string()),
  }),
  colors: z.object({
    primary: ColorSchema,
    secondary: z.array(ColorSchema),
    accent: z.array(ColorSchema),
    semantic: z.object({
      success: ColorSchema,
      warning: ColorSchema,
      error: ColorSchema,
      info: ColorSchema,
    }),
    gradients: z.array(GradientSchema),
    usage: z.record(z.string()),
  }),
  typography: z.object({
    headingFont: FontSchema,
    bodyFont: FontSchema,
    accentFont: FontSchema.optional(),
    scale: z.record(z.number()),
    weights: z.array(z.number()),
    lineHeight: z.record(z.number()),
    letterSpacing: z.record(z.number()),
  }),
  imagery: z.object({
    style: z.enum(['photography', 'illustration', 'mixed', '3d', 'abstract']),
    mood: z.array(z.string()),
    subjects: z.array(z.string()),
    filters: z.array(z.string()),
    doExamples: z.array(AssetSchema),
    dontExamples: z.array(AssetSchema),
    stockPhotoSources: z.array(z.string()),
  }),
  iconography: z.object({
    style: z.enum(['line', 'filled', 'duo-tone', 'custom']),
    library: z.string(),
    customIcons: z.array(AssetSchema),
    usage: z.record(z.string()),
  }),
  patterns: z.object({
    textures: z.array(AssetSchema),
    shapes: z.array(AssetSchema),
    backgrounds: z.array(AssetSchema),
    decorativeElements: z.array(AssetSchema),
  }),
  motion: z.object({
    transitions: z.enum(['none', 'subtle', 'moderate', 'dynamic']),
    duration: z.record(z.number()),
    easing: z.array(z.string()),
    microInteractions: z.boolean(),
    scrollEffects: z.enum(['none', 'parallax', 'reveal', 'sticky']),
  }),
});

const BrandAssetsSchema = z.object({
  logos: z.array(AssetSchema),
  photos: z.object({
    team: z.array(AssetSchema),
    office: z.array(AssetSchema),
    products: z.array(AssetSchema),
    services: z.array(AssetSchema),
    customers: z.array(AssetSchema),
    events: z.array(AssetSchema),
  }),
  videos: z.object({
    hero: AssetSchema.optional(),
    about: AssetSchema.optional(),
    testimonials: z.array(AssetSchema),
    productDemos: z.array(AssetSchema),
    howTo: z.array(AssetSchema),
  }),
  documents: z.object({
    brandGuidelines: AssetSchema.optional(),
    styleGuide: AssetSchema.optional(),
    presentations: z.array(AssetSchema),
    brochures: z.array(AssetSchema),
    certificates: z.array(AssetSchema),
  }),
});

const BrandSchema = z.object({
  positioning: BrandPositioningSchema,
  voice: BrandVoiceSchema,
  visual: BrandVisualSchema,
  assets: BrandAssetsSchema,
});

// ==================== PRODUCTS & SERVICES ====================

const OfferingsPricingSchema = z.object({
  strategy: z.enum(['fixed', 'hourly', 'project', 'value', 'subscription', 'tiered']),
  display: z.enum(['show-all', 'show-range', 'show-starting', 'contact-only']),
  currency: z.string().default('USD'),
  taxInclusive: z.boolean(),
  customQuotes: z.boolean(),
  onlineEstimates: z.boolean(),
  bookingRequired: z.boolean(),
  depositRequired: z.boolean(),
  depositAmount: z.union([z.number(), z.string()]),
});

const OfferingsDeliverySchema = z.object({
  methods: z.array(z.enum(['in-person', 'remote', 'hybrid', 'shipping'])),
  turnaround: z.object({
    standard: z.string(),
    rush: z.string(),
    emergency: z.string(),
  }),
  scheduling: z.object({
    bookingWindow: z.string(),
    availability: AvailabilityScheduleSchema,
    bufferTime: z.number(),
    cancellationPolicy: z.string(),
  }),
});

const OfferingsProcessSchema = z.object({
  consultation: z.any(),
  quotation: z.any(),
  execution: z.array(z.any()),
  delivery: z.any(),
  followUp: z.any(),
});

const OfferingsGuaranteesSchema = z.object({
  satisfaction: z.string(),
  priceMatch: z.boolean(),
  warranty: z.string(),
  returns: z.string(),
  refunds: z.string(),
});

const OfferingsSchema = z.object({
  services: z.array(ServiceSchema),
  products: z.array(ProductSchema),
  packages: z.array(PackageSchema),
  pricing: OfferingsPricingSchema,
  delivery: OfferingsDeliverySchema,
  process: OfferingsProcessSchema,
  guarantees: OfferingsGuaranteesSchema,
});

// ==================== TARGET AUDIENCE ====================

const AudienceJourneySchema = z.object({
  awareness: z.any(),
  consideration: z.any(),
  decision: z.any(),
  purchase: z.any(),
  retention: z.any(),
  advocacy: z.any(),
});

const AudiencePsychographicsSchema = z.object({
  values: z.array(z.string()),
  interests: z.array(z.string()),
  lifestyle: z.array(z.string()),
  painPoints: z.array(z.any()),
  goals: z.array(z.string()),
  objections: z.array(z.string()),
  triggers: z.array(z.string()),
});

const AudienceBehaviorSchema = z.object({
  researchMethods: z.array(z.string()),
  decisionFactors: z.array(z.string()),
  contentPreferences: z.array(z.string()),
  communicationPreferences: z.array(z.string()),
  deviceUsage: z.any(),
  socialPlatforms: z.array(z.string()),
  buyingCycle: z.string(),
  seasonality: z.array(z.string()),
});

const AudienceSchema = z.object({
  segments: z.array(CustomerSegmentSchema),
  personas: z.object({
    primary: PersonaSchema,
    secondary: z.array(PersonaSchema),
    negative: z.array(PersonaSchema),
  }),
  journey: AudienceJourneySchema,
  psychographics: AudiencePsychographicsSchema,
  behavior: AudienceBehaviorSchema,
});

// ==================== MARKETING & SALES ====================

const MarketingCampaignsSchema = z.object({
  active: z.array(z.any()),
  seasonal: z.array(z.any()),
  evergreen: z.array(z.any()),
  planned: z.array(z.any()),
});

const MarketingChannelsSchema = z.object({
  organic: z.object({
    seo: z.boolean(),
    content: z.boolean(),
    social: z.array(z.string()),
    email: z.boolean(),
    referral: z.boolean(),
  }),
  paid: z.object({
    googleAds: z.boolean(),
    facebookAds: z.boolean(),
    linkedinAds: z.boolean(),
    display: z.boolean(),
    retargeting: z.boolean(),
    traditional: z.array(z.string()),
  }),
  partnerships: z.object({
    affiliates: z.array(z.string()),
    referralPartners: z.array(z.string()),
    coMarketing: z.array(z.string()),
  }),
});

const MarketingContentSchema = z.object({
  blog: z.object({
    frequency: z.string(),
    topics: z.array(z.string()),
    authors: z.array(z.string()),
    style: z.string(),
  }),
  social: z.object({
    platforms: z.array(z.any()),
    postingSchedule: z.record(z.string()),
    contentMix: z.record(z.number()),
  }),
  email: z.object({
    lists: z.array(z.any()),
    automations: z.array(z.any()),
    newsletters: z.array(z.any()),
  }),
  resources: z.object({
    ebooks: z.array(AssetSchema),
    whitepapers: z.array(AssetSchema),
    caseStudies: z.array(AssetSchema),
    webinars: z.array(AssetSchema),
    tools: z.array(AssetSchema),
  }),
});

const MarketingMessagingSchema = z.object({
  headlines: z.record(z.string()),
  callToActions: z.record(z.any()),
  socialProof: z.array(z.string()),
  urgency: z.array(z.string()),
  benefits: z.array(z.any()),
  features: z.array(z.any()),
  faqs: z.array(z.any()),
});

const MarketingConversionSchema = z.object({
  goals: z.array(z.any()),
  funnels: z.array(z.any()),
  leadMagnets: z.array(z.any()),
  forms: z.array(FormRequirementSchema),
  tracking: z.object({
    analytics: z.array(z.string()),
    pixels: z.array(z.string()),
    heatmaps: z.boolean(),
    sessionRecording: z.boolean(),
    aBTesting: z.boolean(),
  }),
});

const MarketingSchema = z.object({
  campaigns: MarketingCampaignsSchema,
  channels: MarketingChannelsSchema,
  content: MarketingContentSchema,
  messaging: MarketingMessagingSchema,
  conversion: MarketingConversionSchema,
});

// ==================== PEOPLE & CULTURE ====================

const TeamCultureSchema = z.object({
  workEnvironment: z.string(),
  teamSize: z.string(),
  remoteFriendly: z.boolean(),
  benefits: z.array(z.string()),
  perks: z.array(z.string()),
  awards: z.array(AwardSchema),
  values: z.array(z.string()),
  diversityStatement: z.string(),
  communityInvolvement: z.array(z.string()),
  sustainability: z.array(z.string()),
});

const TeamExpertiseSchema = z.object({
  coreCompetencies: z.array(z.string()),
  certifications: z.array(CertificationSchema),
  training: z.array(z.string()),
  experience: z.string(),
  projectCount: z.number(),
  specializations: z.array(z.string()),
});

const TeamSchema = z.object({
  leadership: z.array(TeamMemberSchema),
  departments: z.array(DepartmentSchema),
  keyPersonnel: z.array(TeamMemberSchema),
  culture: TeamCultureSchema,
  expertise: TeamExpertiseSchema,
});

// ==================== SOCIAL PROOF ====================

const CredibilityReviewsSchema = z.object({
  google: z.any(),
  facebook: z.any(),
  yelp: z.any(),
  bbb: z.any(),
  industrySpecific: z.array(z.any()),
});

const CredibilityMediaSchema = z.object({
  mentions: z.array(z.any()),
  pressReleases: z.array(z.any()),
  interviews: z.array(z.any()),
  publications: z.array(z.any()),
});

const CredibilityStatsSchema = z.object({
  yearsInBusiness: z.number(),
  projectsCompleted: z.number(),
  customersServed: z.number(),
  satisfactionRate: z.number(),
  repeatBusinessRate: z.number(),
  referralRate: z.number(),
  customMetrics: z.record(z.any()),
});

const CredibilitySchema = z.object({
  testimonials: z.array(TestimonialSchema),
  caseStudies: z.array(CaseStudySchema),
  portfolio: z.array(PortfolioItemSchema),
  reviews: CredibilityReviewsSchema,
  awards: z.array(AwardSchema),
  certifications: z.array(CertificationSchema),
  accreditations: z.array(z.any()),
  memberships: z.array(z.any()),
  partnerships: z.array(z.any()),
  media: CredibilityMediaSchema,
  stats: CredibilityStatsSchema,
});

// ==================== WEBSITE REQUIREMENTS ====================

const WebsiteGoalsSchema = z.object({
  primary: z.array(z.string()),
  secondary: z.array(z.string()),
  kpis: z.array(KPISchema),
  conversionTargets: z.array(z.any()),
});

const WebsiteStructureSchema = z.object({
  sitemap: z.array(z.any()),
  navigation: z.object({
    primary: z.array(z.any()),
    secondary: z.array(z.any()),
    footer: z.array(z.any()),
    mobile: z.array(z.any()),
  }),
  userFlows: z.array(z.any()),
  wireframes: z.array(AssetSchema).optional(),
});

const WebsitePagesSchema = z.object({
  home: z.any(),
  about: z.any(),
  services: z.array(z.any()),
  contact: z.any(),
  custom: z.array(z.any()),
  legal: z.array(z.any()),
  utility: z.array(z.any()),
});

const WebsiteFeaturesSchema = z.object({
  essential: z.array(z.string()),
  nice: z.array(z.string()),
  future: z.array(z.string()),
  forms: z.array(FormRequirementSchema),
  calculators: z.array(z.any()),
  portals: z.array(z.any()),
  booking: z.any(),
  ecommerce: z.any(),
  search: z.any(),
  chat: z.any(),
});

const WebsiteDesignSchema = z.object({
  inspiration: z.array(z.string().url()),
  style: z.enum(['modern', 'classic', 'minimal', 'bold', 'playful', 'luxury']),
  layout: z.enum(['wide', 'boxed', 'full-width']),
  density: z.enum(['spacious', 'balanced', 'compact']),
  emphasis: z.array(z.string()),
  avoid: z.array(z.string()),
});

const WebsiteTechnicalSchema = z.object({
  platform: z.enum(['nextjs', 'wordpress', 'shopify', 'custom']),
  hosting: z.enum(['vercel', 'netlify', 'aws', 'custom']),
  performance: z.object({
    targetLoadTime: z.number(),
    targetLighthouseScore: z.number(),
    targetPageSize: z.number(),
    cdnRequired: z.boolean(),
    ampRequired: z.boolean(),
  }),
  seo: SEORequirementsSchema,
  accessibility: z.object({
    wcagLevel: z.enum(['A', 'AA', 'AAA']),
    screenReaderOptimized: z.boolean(),
    keyboardNavigation: z.boolean(),
    highContrast: z.boolean(),
  }),
  security: z.object({
    sslRequired: z.boolean(),
    twoFactorAuth: z.boolean(),
    gdprCompliant: z.boolean(),
    ccpaCompliant: z.boolean(),
    hipaaCompliant: z.boolean(),
    pciCompliant: z.boolean(),
    dataEncryption: z.boolean(),
    backupFrequency: z.string(),
  }),
  browser: z.object({
    modern: z.array(z.string()),
    legacy: z.array(z.string()),
    mobile: z.array(z.string()),
  }),
});

const WebsiteIntegrationsSchema = z.object({
  required: z.array(IntegrationSchema),
  optional: z.array(IntegrationSchema),
  future: z.array(IntegrationSchema),
});

const WebsiteContentSchema = z.object({
  migration: z.object({
    needed: z.boolean(),
    source: z.string(),
    pages: z.number(),
    posts: z.number(),
    products: z.number(),
    preserveUrls: z.boolean(),
    redirectMap: z.record(z.string()),
  }),
  management: z.object({
    cms: z.enum(['headless', 'traditional', 'static', 'hybrid']),
    editors: z.array(z.string()),
    workflow: z.string(),
    multilingual: z.array(z.any()),
  }),
});

const WebsiteSchema = z.object({
  goals: WebsiteGoalsSchema,
  structure: WebsiteStructureSchema,
  pages: WebsitePagesSchema,
  features: WebsiteFeaturesSchema,
  design: WebsiteDesignSchema,
  technical: WebsiteTechnicalSchema,
  integrations: WebsiteIntegrationsSchema,
  content: WebsiteContentSchema,
});

// ==================== CUSTOMER SERVICE ====================

const SupportChannelsSchema = z.object({
  phone: z.any(),
  email: z.any(),
  chat: z.any(),
  social: z.any(),
  inPerson: z.any(),
});

const SupportResourcesSchema = z.object({
  knowledgeBase: z.boolean(),
  faqs: z.array(z.any()),
  tutorials: z.array(z.any()),
  documentation: z.array(z.any()),
  communityForum: z.boolean(),
  ticketingSystem: z.string(),
});

const SupportSLASchema = z.object({
  responseTime: z.record(z.string()),
  resolutionTime: z.record(z.string()),
  availability: z.string(),
  holidays: z.array(z.string()),
  escalation: z.array(z.any()),
});

const SupportPoliciesSchema = z.object({
  returns: z.string(),
  refunds: z.string(),
  warranty: z.string(),
  privacy: z.string(),
  terms: z.string(),
  shipping: z.string(),
});

const SupportSchema = z.object({
  channels: SupportChannelsSchema,
  resources: SupportResourcesSchema,
  sla: SupportSLASchema,
  policies: SupportPoliciesSchema,
});

// ==================== LOCAL & LOCATION ====================

const LocalSEOSchema = z.object({
  googleMyBusiness: z.any(),
  appleMaps: z.string(),
  bingPlaces: z.string(),
  citations: z.array(z.any()),
  geoTargeting: z.array(z.any()),
});

const LocalCommunitySchema = z.object({
  involvement: z.array(z.string()),
  sponsorships: z.array(z.string()),
  partnerships: z.array(z.string()),
  events: z.array(z.any()),
  charities: z.array(z.string()),
});

const LocalCompetitionSchema = z.object({
  direct: z.array(CompetitorSchema),
  indirect: z.array(CompetitorSchema),
  advantages: z.array(z.string()),
  weaknesses: z.array(z.string()),
  opportunities: z.array(z.string()),
  threats: z.array(z.string()),
});

const LocalSchema = z.object({
  seo: LocalSEOSchema,
  community: LocalCommunitySchema,
  competition: LocalCompetitionSchema,
});

// ==================== COMPLIANCE & LEGAL ====================

const ComplianceDataSchema = z.object({
  gdpr: z.any(),
  ccpa: z.any(),
  coppa: z.boolean(),
  dataRetention: z.string(),
  cookiePolicy: z.string(),
});

const ComplianceIndustrySchema = z.object({
  standards: z.array(z.string()),
  requirements: z.array(z.string()),
  audits: z.array(z.any()),
  certifications: z.array(CertificationSchema),
});

const ComplianceLegalSchema = z.object({
  entityName: z.string(),
  tradenames: z.array(z.string()),
  trademarks: z.array(z.string()),
  copyrights: z.array(z.string()),
  patents: z.array(z.string()),
  disclaimer: z.string(),
  termsOfService: z.string(),
  privacyPolicy: z.string(),
});

const ComplianceSchema = z.object({
  licenses: z.array(z.any()),
  permits: z.array(z.any()),
  regulations: z.array(z.any()),
  data: ComplianceDataSchema,
  industry: ComplianceIndustrySchema,
  legal: ComplianceLegalSchema,
});

// ==================== METADATA & OPERATIONS ====================

const MetadataSchema = z.object({
  projectId: z.string(),
  agentRuns: z.array(z.any()),
  qualityScores: z.array(z.any()),
  versions: z.array(z.any()),
  notes: z.array(z.any()),
  customFields: z.record(z.any()).optional(),
  flags: z.array(z.string()),
  tags: z.array(z.string()),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['draft', 'review', 'approved', 'active', 'archived']),
});

// ==================== MAIN CLIENT PROFILE SCHEMA ====================

export const ClientProfileSchema = z.object({
  // Core Identification
  id: z.string().uuid(),
  version: z.string().default('1.0.0'),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastSyncedAt: z.date(),

  // Main Sections
  company: CompanySchema,
  brand: BrandSchema,
  offerings: OfferingsSchema,
  audience: AudienceSchema,
  marketing: MarketingSchema,
  team: TeamSchema,
  credibility: CredibilitySchema,
  website: WebsiteSchema,
  support: SupportSchema,
  locations: z.array(LocationSchema),
  local: LocalSchema,
  compliance: ComplianceSchema,
  metadata: MetadataSchema,
});

// Export type
export type ClientProfile = z.infer<typeof ClientProfileSchema>;

// Export all sub-schemas for partial validation
export {
  CompanySchema,
  BrandSchema,
  OfferingsSchema,
  AudienceSchema,
  MarketingSchema,
  TeamSchema,
  CredibilitySchema,
  WebsiteSchema,
  SupportSchema,
  LocalSchema,
  ComplianceSchema,
  MetadataSchema,
};
