import { z } from 'zod';

/**
 * Supporting types for ClientProfile
 * Convert all TypeScript interfaces to Zod schemas for runtime validation
 *
 * NOTE: This is a starter implementation. Additional types from your
 * client-profile-types.ts interfaces should be added here following
 * the same Zod schema pattern.
 */

// ==================== CORE VALUE TYPES ====================

export const RGBSchema = z.object({
  r: z.number().min(0).max(255),
  g: z.number().min(0).max(255),
  b: z.number().min(0).max(255),
  a: z.number().min(0).max(1).optional(),
});

export const HSLSchema = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  l: z.number().min(0).max(100),
  a: z.number().min(0).max(1).optional(),
});

export const CMYKSchema = z.object({
  c: z.number().min(0).max(100),
  m: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  k: z.number().min(0).max(100),
});

export const LABSchema = z.object({
  l: z.number(),
  a: z.number(),
  b: z.number(),
});

export const ColorSchema: z.ZodType<any> = z.object({
  name: z.string(),
  values: z.object({
    hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    rgb: RGBSchema,
    hsl: HSLSchema,
    cmyk: CMYKSchema.optional(),
    pantone: z.string().optional(),
    lab: LABSchema.optional(),
  }),
  usage: z.object({
    primary: z.boolean(),
    contexts: z.array(z.enum(['background', 'text', 'accent', 'border', 'shadow'])),
    doNotUse: z.array(z.string()).optional(),
    accessibility: z.any(), // TODO: Define AccessibilityColors
  }),
  variations: z
    .object({
      light: z.lazy(() => ColorSchema).optional(),
      dark: z.lazy(() => ColorSchema).optional(),
      muted: z.lazy(() => ColorSchema).optional(),
      vibrant: z.lazy(() => ColorSchema).optional(),
      tints: z.array(z.lazy(() => ColorSchema)).optional(),
      shades: z.array(z.lazy(() => ColorSchema)).optional(),
    })
    .optional(),
});

export const GradientSchema = z.object({
  name: z.string(),
  type: z.enum(['linear', 'radial', 'conic']),
  colors: z.array(
    z.object({
      color: ColorSchema,
      position: z.number().min(0).max(100),
    })
  ),
  angle: z.number().optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
  css: z.string(),
  usage: z.array(z.string()),
});

// ==================== DIMENSIONS & MEASUREMENTS ====================

export const DimensionsSchema = z.object({
  length: z.number(),
  width: z.number(),
  height: z.number(),
  unit: z.enum(['inch', 'cm', 'mm']),
});

export const WeightSchema = z.object({
  value: z.number(),
  unit: z.enum(['lb', 'oz', 'kg', 'g']),
});

export const DurationSchema = z.object({
  min: z.number(),
  max: z.number(),
  typical: z.number(),
  unit: z.enum(['minutes', 'hours', 'days', 'weeks']),
});

// ==================== ADDRESS & LOCATION ====================

export const AddressSchema = z.object({
  street1: z.string(),
  street2: z.string().optional(),
  street3: z.string().optional(),
  city: z.string(),
  state: z.string(),
  stateCode: z.string(),
  zip: z.string(),
  zipPlus4: z.string().optional(),
  county: z.string().optional(),
  country: z.string(),
  countryCode: z.string(),
  coordinates: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      accuracy: z.number().optional(),
      altitude: z.number().optional(),
    })
    .optional(),
  formatted: z
    .object({
      singleLine: z.string(),
      multiLine: z.string(),
      international: z.string().optional(),
    })
    .optional(),
  validation: z
    .object({
      verified: z.boolean(),
      verifiedDate: z.date().optional(),
      source: z.string().optional(),
      corrections: z.array(z.string()).optional(),
    })
    .optional(),
});

// ==================== ASSETS & MEDIA ====================

export const AssetVariantSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  width: z.number().optional(),
  height: z.number().optional(),
  format: z.string().optional(),
  quality: z.number().optional(),
  size: z.number(),
});

export const AssetSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['image', 'video', 'audio', 'document', 'embed', '3d']),
  file: z.object({
    url: z.string().url(),
    cdnUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
    previewUrl: z.string().url().optional(),
    downloadUrl: z.string().url().optional(),
  }),
  details: z.object({
    name: z.string(),
    filename: z.string(),
    mimeType: z.string(),
    size: z.number(),
    hash: z.string().optional(),
  }),
  content: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    altText: z.string().optional(),
    caption: z.string().optional(),
    transcript: z.string().optional(),
    tags: z.array(z.string()),
  }),
  dimensions: z
    .object({
      width: z.number(),
      height: z.number(),
      duration: z.number().optional(),
      aspectRatio: z.string().optional(),
    })
    .optional(),
  variants: z.array(AssetVariantSchema).optional(),
  metadata: z.object({
    credit: z.string().optional(),
    copyright: z.string().optional(),
    license: z.string().optional(),
    source: z.string().optional(),
    author: z.string().optional(),
    dateTaken: z.date().optional(),
    location: z.string().optional(),
    exif: z.record(z.any()).optional(),
  }),
  optimization: z
    .object({
      compressed: z.boolean(),
      format: z.string().optional(),
      quality: z.number().optional(),
      responsive: z.array(z.any()).optional(),
    })
    .optional(),
  usage: z.object({
    pages: z.array(z.string()).optional(),
    sections: z.array(z.string()).optional(),
    count: z.number(),
    lastUsed: z.date().optional(),
  }),
  permissions: z.object({
    public: z.boolean(),
    downloadable: z.boolean(),
    embeddable: z.boolean(),
    licensedUntil: z.date().optional(),
    restrictions: z.array(z.string()).optional(),
  }),
  created: z.object({
    date: z.date(),
    by: z.string(),
    method: z.enum(['upload', 'generated', 'imported', 'captured']),
  }),
});

// ==================== TYPOGRAPHY ====================

export const FontWeightSchema = z.object({
  weight: z.union([
    z.literal(100),
    z.literal(200),
    z.literal(300),
    z.literal(400),
    z.literal(500),
    z.literal(600),
    z.literal(700),
    z.literal(800),
    z.literal(900),
  ]),
  name: z.string(),
  italic: z.boolean().optional(),
});

export const FontSchema = z.object({
  family: z.string(),
  fallbacks: z.array(z.string()),
  source: z.object({
    type: z.enum(['system', 'google', 'adobe', 'custom']),
    url: z.string().url().optional(),
    license: z.string().optional(),
  }),
  weights: z.array(FontWeightSchema),
  styles: z.array(z.enum(['normal', 'italic', 'oblique'])),
  usage: z.object({
    headings: z.boolean().optional(),
    body: z.boolean().optional(),
    captions: z.boolean().optional(),
    buttons: z.boolean().optional(),
    special: z.array(z.string()).optional(),
  }),
  features: z
    .object({
      ligatures: z.boolean().optional(),
      kerning: z.boolean().optional(),
      alternates: z.boolean().optional(),
      smallCaps: z.boolean().optional(),
      numeralStyle: z.enum(['oldstyle', 'lining', 'tabular']).optional(),
    })
    .optional(),
  performance: z
    .object({
      subset: z.array(z.string()).optional(),
      preload: z.boolean().optional(),
      display: z.enum(['auto', 'block', 'swap', 'fallback', 'optional']),
    })
    .optional(),
});

// ==================== BUSINESS OPERATIONS ====================

export const TimePeriodSchema = z.object({
  open: z.string(),
  close: z.string(),
  type: z.enum(['regular', 'appointment-only', 'emergency']).optional(),
});

export const DayHoursSchema = z.object({
  open: z.boolean(),
  periods: z.array(TimePeriodSchema),
  note: z.string().optional(),
});

export const DateExceptionSchema = z.object({
  date: z.date(),
  name: z.string().optional(),
  hours: DayHoursSchema.optional(),
  closed: z.boolean(),
  note: z.string().optional(),
});

export const BusinessHoursSchema = z.object({
  monday: DayHoursSchema.optional(),
  tuesday: DayHoursSchema.optional(),
  wednesday: DayHoursSchema.optional(),
  thursday: DayHoursSchema.optional(),
  friday: DayHoursSchema.optional(),
  saturday: DayHoursSchema.optional(),
  sunday: DayHoursSchema.optional(),
  holidays: z.enum(['closed', 'reduced', 'normal']).optional(),
  exceptions: z.array(DateExceptionSchema).optional(),
  note: z.string().optional(),
});

export const AvailabilityScheduleSchema = z.object({
  timezone: z.string(),
  businessHours: BusinessHoursSchema,
  bookingWindow: z.object({
    advanceBooking: DurationSchema,
    bufferTime: DurationSchema.optional(),
    minimumNotice: DurationSchema.optional(),
  }),
  blackoutDates: z.array(z.date()).optional(),
  capacity: z
    .object({
      maxPerDay: z.number().optional(),
      maxPerWeek: z.number().optional(),
      maxConcurrent: z.number().optional(),
    })
    .optional(),
});

// ==================== PAYMENT & PRICING ====================

export const PaymentMethodSchema = z.object({
  type: z.enum([
    'credit-card',
    'debit-card',
    'ach',
    'wire',
    'check',
    'cash',
    'crypto',
    'financing',
  ]),
  accepted: z.boolean(),
  preferred: z.boolean().optional(),
  processor: z.string().optional(),
  fees: z.number().optional(),
  minimumAmount: z.number().optional(),
  maximumAmount: z.number().optional(),
});

export const PriceTierSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  minQuantity: z.number(),
  maxQuantity: z.number().optional(),
  price: z.number(),
  unit: z.string().optional(),
});

// ==================== PEOPLE ====================

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  graduationYear: z.number().optional(),
  honors: z.array(z.string()).optional(),
});

export const CertificationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  issuingOrganization: z.string(),
  credentialId: z.string().optional(),
  dates: z.object({
    earned: z.date(),
    expires: z.date().optional(),
    renewed: z.date().optional(),
  }),
  verification: z.object({
    url: z.string().url().optional(),
    document: AssetSchema.optional(),
    verified: z.boolean(),
    verifiedDate: z.date().optional(),
  }),
  scope: z.object({
    level: z.string().optional(),
    specialization: z.string().optional(),
    geographic: z.string().optional(),
  }),
  maintenance: z
    .object({
      ceuRequired: z.number().optional(),
      renewalPeriod: z.string().optional(),
      currentStatus: z.enum(['active', 'expired', 'suspended', 'pending']),
    })
    .optional(),
  display: z.object({
    showOnWebsite: z.boolean(),
    badge: AssetSchema.optional(),
    priority: z.number(),
  }),
});

export const TeamMemberSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  pronouns: z.string().optional(),
  role: z.object({
    title: z.string(),
    department: z.string(),
    level: z.enum(['executive', 'management', 'senior', 'mid', 'junior', 'entry']),
    type: z.enum(['full-time', 'part-time', 'contractor', 'advisor']),
    reportsTo: z.string().uuid().optional(),
  }),
  bio: z.object({
    short: z.string(),
    long: z.string(),
    expertise: z.array(z.string()),
    specializations: z.array(z.string()),
    interests: z.array(z.string()).optional(),
    personalNote: z.string().optional(),
  }),
  credentials: z.object({
    education: z.array(EducationSchema),
    certifications: z.array(CertificationSchema),
    licenses: z.array(z.any()), // TODO: Define LicenseSchema
    awards: z.array(z.any()), // Defined below
    publications: z.array(z.any()).optional(),
    speaking: z.array(z.any()).optional(),
  }),
  experience: z.object({
    yearsInIndustry: z.number(),
    yearsAtCompany: z.number(),
    previousRoles: z.array(z.any()).optional(),
    notableProjects: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
  }),
  contact: z.object({
    email: z.string().email(),
    phone: z.string().optional(),
    extension: z.string().optional(),
    mobile: z.string().optional(),
    preferredContact: z.enum(['email', 'phone', 'text']),
    availability: z.string().optional(),
  }),
  online: z.object({
    profileUrl: z.string().url().optional(),
    calendar: z.string().url().optional(),
    linkedin: z.string().url().optional(),
    twitter: z.string().url().optional(),
    github: z.string().url().optional(),
    personalWebsite: z.string().url().optional(),
  }),
  media: z.object({
    headshot: AssetSchema,
    casualPhoto: AssetSchema.optional(),
    actionPhoto: AssetSchema.optional(),
    teamPhoto: AssetSchema.optional(),
  }),
  display: z.object({
    featured: z.boolean(),
    showOnWebsite: z.boolean(),
    showContact: z.boolean(),
    order: z.number(),
    customTitle: z.string().optional(),
  }),
  metadata: z.object({
    startDate: z.date(),
    anniversaryDate: z.date().optional(),
    birthday: z.date().optional(),
    location: z.string().optional(),
    remoteWorker: z.boolean(),
    timezone: z.string().optional(),
    languages: z.array(z.string()).optional(),
    emergencyContact: z.any().optional(),
  }),
});

export const DepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  headId: z.string().uuid(),
  members: z.array(z.string().uuid()),
  responsibilities: z.array(z.string()),
  services: z.array(z.string().uuid()),
  contact: z.object({
    email: z.string().email().optional(),
    phone: z.string().optional(),
    extension: z.string().optional(),
  }),
  metrics: z
    .object({
      size: z.number(),
      budget: z.number().optional(),
      kpis: z.array(z.any()).optional(),
    })
    .optional(),
});

export const AwardSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  issuingOrganization: z.string(),
  dates: z.object({
    received: z.date(),
    announced: z.date().optional(),
    ceremony: z.date().optional(),
  }),
  category: z.string().optional(),
  level: z.enum(['local', 'regional', 'national', 'international']).optional(),
  competition: z
    .object({
      nominees: z.number().optional(),
      winner: z.boolean(),
      placement: z.string().optional(),
    })
    .optional(),
  media: z
    .object({
      trophy: AssetSchema.optional(),
      certificate: AssetSchema.optional(),
      photo: AssetSchema.optional(),
      pressRelease: z.string().optional(),
      coverage: z.array(z.any()).optional(),
    })
    .optional(),
  significance: z.object({
    description: z.string(),
    impact: z.string().optional(),
    prestige: z.enum(['high', 'medium', 'standard']),
  }),
  display: z.object({
    featured: z.boolean(),
    order: z.number(),
    showYear: z.boolean(),
  }),
});

// ==================== SOCIAL PROOF ====================

export const TestimonialSchema = z.object({
  id: z.string().uuid(),
  author: z.object({
    name: z.string(),
    title: z.string().optional(),
    company: z.string().optional(),
    location: z.string().optional(),
    photo: AssetSchema.optional(),
    verified: z.boolean(),
  }),
  content: z.object({
    headline: z.string().optional(),
    quote: z.string(),
    fullStory: z.string().optional(),
    rating: z.number().min(1).max(5).optional(),
  }),
  context: z.object({
    service: z.string().uuid().optional(),
    product: z.string().uuid().optional(),
    project: z.string().uuid().optional(),
    date: z.date(),
    platform: z.string().optional(),
  }),
  media: z
    .object({
      video: AssetSchema.optional(),
      audio: AssetSchema.optional(),
      beforeAfter: z.any().optional(),
    })
    .optional(),
  metrics: z
    .object({
      result: z.string().optional(),
      improvement: z.number().optional(),
      roi: z.number().optional(),
      timeframe: z.string().optional(),
    })
    .optional(),
  usage: z.object({
    featured: z.boolean(),
    homepage: z.boolean(),
    servicePage: z.array(z.string()).optional(),
    marketingMaterials: z.array(z.string()).optional(),
    socialMedia: z.boolean().optional(),
  }),
  permissions: z.object({
    hasConsent: z.boolean(),
    consentDate: z.date().optional(),
    expiryDate: z.date().optional(),
    restrictions: z.array(z.string()).optional(),
  }),
  metadata: z.object({
    source: z.enum(['direct', 'review-platform', 'social', 'email', 'survey']),
    originalUrl: z.string().url().optional(),
    verified: z.boolean(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    tags: z.array(z.string()),
  }),
});

export const CaseStudySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  slug: z.string(),
  client: z.object({
    name: z.string(),
    industry: z.string(),
    size: z.string(),
    location: z.string(),
    logo: AssetSchema.optional(),
    anonymized: z.boolean().optional(),
  }),
  challenge: z.object({
    summary: z.string(),
    details: z.array(z.string()),
    painPoints: z.array(z.string()),
    previousAttempts: z.array(z.string()).optional(),
    constraints: z.array(z.string()).optional(),
  }),
  solution: z.object({
    summary: z.string(),
    approach: z.array(z.string()),
    services: z.array(z.string().uuid()),
    products: z.array(z.string().uuid()).optional(),
    timeline: z.string(),
    team: z.array(z.string().uuid()).optional(),
    innovation: z.array(z.string()).optional(),
  }),
  implementation: z.object({
    phases: z.array(z.any()),
    challenges: z.array(z.string()).optional(),
    adjustments: z.array(z.string()).optional(),
    collaboration: z.string().optional(),
  }),
  results: z.object({
    summary: z.string(),
    metrics: z.array(z.any()),
    testimonial: z.string().uuid().optional(),
    beforeAfter: z.any().optional(),
    roi: z.number().optional(),
    paybackPeriod: z.string().optional(),
  }),
  lessons: z.object({
    learned: z.array(z.string()),
    bestPractices: z.array(z.string()),
    futureApplications: z.array(z.string()).optional(),
  }),
  media: z.object({
    heroImage: AssetSchema,
    gallery: z.array(AssetSchema).optional(),
    video: AssetSchema.optional(),
    documents: z.array(AssetSchema).optional(),
  }),
  metadata: z.object({
    publishDate: z.date(),
    featured: z.boolean(),
    industry: z.array(z.string()),
    services: z.array(z.string()),
    tags: z.array(z.string()),
    readTime: z.number().optional(),
  }),
});

export const PortfolioItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  category: z.string(),
  description: z.object({
    brief: z.string(),
    detailed: z.string().optional(),
    role: z.string().optional(),
    contributions: z.array(z.string()).optional(),
  }),
  details: z.object({
    client: z.string().optional(),
    date: z.date(),
    duration: z.string().optional(),
    budget: z.string().optional(),
    team: z.array(z.string()).optional(),
    technologies: z.array(z.string()).optional(),
    techniques: z.array(z.string()).optional(),
  }),
  media: z.object({
    thumbnail: AssetSchema,
    hero: AssetSchema.optional(),
    gallery: z.array(AssetSchema),
    video: AssetSchema.optional(),
    virtualTour: z.string().url().optional(),
  }),
  results: z
    .object({
      metrics: z.record(z.string()).optional(),
      awards: z.array(z.string()).optional(),
      recognition: z.array(z.string()).optional(),
      testimonial: z.string().uuid().optional(),
    })
    .optional(),
  display: z.object({
    featured: z.boolean(),
    order: z.number(),
    layout: z.enum(['standard', 'wide', 'minimal', 'detailed']).optional(),
    tags: z.array(z.string()),
  }),
});

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  platform: z.string(),
  author: z.object({
    name: z.string(),
    username: z.string().optional(),
    verified: z.boolean().optional(),
    profileUrl: z.string().url().optional(),
    reviewCount: z.number().optional(),
  }),
  content: z.object({
    rating: z.number().min(1).max(5),
    title: z.string().optional(),
    text: z.string(),
    pros: z.array(z.string()).optional(),
    cons: z.array(z.string()).optional(),
  }),
  context: z.object({
    date: z.date(),
    service: z.string().optional(),
    product: z.string().optional(),
    location: z.string().optional(),
    verified_purchase: z.boolean().optional(),
  }),
  response: z
    .object({
      text: z.string(),
      date: z.date(),
      author: z.string(),
    })
    .optional(),
  metrics: z
    .object({
      helpful: z.number(),
      unhelpful: z.number(),
      reported: z.boolean().optional(),
    })
    .optional(),
  media: z
    .object({
      photos: z.array(AssetSchema).optional(),
      videos: z.array(AssetSchema).optional(),
    })
    .optional(),
  analysis: z
    .object({
      sentiment: z.enum(['positive', 'neutral', 'negative']),
      topics: z.array(z.string()),
      keywords: z.array(z.string()),
    })
    .optional(),
});

// ==================== SERVICES & PRODUCTS ====================

// TODO: These should be fully defined from your client-profile-types.ts
// Simplified versions for now:

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  displayName: z.string(),
  slug: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  description: z.any(), // TODO: Full ServiceDescription
  pricing: z.any(), // TODO: Full ServicePricing
  eligibility: z.any().optional(),
  execution: z.any(),
  portfolio: z.any().optional(),
  team: z.any().optional(),
  quality: z.any().optional(),
  marketing: z.any().optional(),
  assets: z.any().optional(),
  related: z.any().optional(),
  reviews: z.any().optional(),
  metadata: z.any(),
});

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  displayName: z.string(),
  sku: z.string(),
  category: z.string(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  description: z.any(),
  pricing: z.any(),
  inventory: z.any(),
  physical: z.any().optional(),
  digital: z.any().optional(),
  variants: z.array(z.any()).optional(),
  options: z.array(z.any()).optional(),
  bundling: z.any().optional(),
  media: z.any(),
  seo: z.any().optional(),
  relationships: z.any().optional(),
  reviews: z.any().optional(),
  compliance: z.any().optional(),
  metadata: z.any(),
});

export const PackageSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['service', 'product', 'mixed']),
  items: z.array(z.any()),
  pricing: z.any(),
  terms: z.any().optional(),
  availability: z.any().optional(),
  customization: z.any().optional(),
});

// ==================== PERSONAS & SEGMENTS ====================

export const PersonaSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  archetype: z.string(),
  demographics: z.any(),
  geographic: z.any(),
  psychographics: z.any(),
  behavior: z.any(),
  needs: z.any(),
  journey: z.any(),
  objections: z.any(),
  messaging: z.any(),
  quotes: z.any(),
  metrics: z.any().optional(),
});

export const CustomerSegmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  size: z.any(),
  value: z.any(),
  characteristics: z.any(),
  strategy: z.any(),
  personas: z.array(z.string().uuid()),
});

// ==================== LOCATIONS ====================

export const LocationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['headquarters', 'office', 'warehouse', 'retail', 'service-area', 'virtual']),
  name: z.string(),
  code: z.string().optional(),
  address: AddressSchema,
  contact: z.object({
    phone: z.string(),
    fax: z.string().optional(),
    email: z.string().email(),
    website: z.string().url().optional(),
  }),
  hours: z.object({
    regular: BusinessHoursSchema,
    holidays: z.array(z.any()),
    exceptions: z.array(DateExceptionSchema),
    timezone: z.string(),
    note: z.string().optional(),
  }),
  team: z.any(),
  capabilities: z.any(),
  physical: z.any().optional(),
  coverage: z.any(),
  online: z.any().optional(),
  media: z.any(),
  performance: z.any().optional(),
  metadata: z.any(),
});

// ==================== SEO & MARKETING ====================

export const SEOKeywordSchema = z.object({
  keyword: z.string(),
  volume: z.number(),
  difficulty: z.number(),
  cpc: z.number().optional(),
  intent: z.enum(['informational', 'navigational', 'commercial', 'transactional']),
  priority: z.enum(['high', 'medium', 'low']),
  currentRank: z.number().optional(),
  targetRank: z.number(),
  url: z.string().url().optional(),
  competitors: z.array(z.string()).optional(),
});

export const CompetitorSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  website: z.string().url(),
  analysis: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    opportunities: z.array(z.string()),
    threats: z.array(z.string()),
  }),
  metrics: z.any().optional(),
  positioning: z.any(),
  monitoring: z.any(),
});

export const SEORequirementsSchema = z.object({
  targets: z.object({
    primaryKeywords: z.array(SEOKeywordSchema),
    secondaryKeywords: z.array(SEOKeywordSchema),
    longTailKeywords: z.array(SEOKeywordSchema),
    localKeywords: z.array(SEOKeywordSchema).optional(),
  }),
  competition: z.object({
    topCompetitors: z.array(CompetitorSchema),
    targetRankings: z.record(z.number()),
    gapAnalysis: z.array(z.string()),
  }),
  technical: z.any(),
  content: z.any(),
  local: z.any().optional(),
  performance: z.any(),
});

// ==================== FORMS & INTEGRATIONS ====================

export const FormRequirementSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum([
    'contact',
    'quote',
    'booking',
    'application',
    'survey',
    'newsletter',
    'custom',
  ]),
  fields: z.array(z.any()),
  behavior: z.any(),
  integration: z.any().optional(),
  tracking: z.any().optional(),
  design: z.any().optional(),
});

export const IntegrationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  provider: z.string(),
  category: z.string(),
  connection: z.any(),
  configuration: z.any(),
  features: z.any(),
  sync: z.any().optional(),
  mapping: z.any().optional(),
  monitoring: z.any().optional(),
});

// ==================== UTILITIES ====================

export const KPISchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  current: z.number(),
  target: z.number(),
  unit: z.string(),
  period: z.string(),
  trend: z.enum(['improving', 'stable', 'declining']),
});

// ==================== TYPE EXPORTS ====================

export type RGB = z.infer<typeof RGBSchema>;
export type HSL = z.infer<typeof HSLSchema>;
export type CMYK = z.infer<typeof CMYKSchema>;
export type LAB = z.infer<typeof LABSchema>;
export type Color = z.infer<typeof ColorSchema>;
export type Gradient = z.infer<typeof GradientSchema>;
export type Dimensions = z.infer<typeof DimensionsSchema>;
export type Weight = z.infer<typeof WeightSchema>;
export type Duration = z.infer<typeof DurationSchema>;
export type Address = z.infer<typeof AddressSchema>;
export type Asset = z.infer<typeof AssetSchema>;
export type Font = z.infer<typeof FontSchema>;
export type FontWeight = z.infer<typeof FontWeightSchema>;
export type BusinessHours = z.infer<typeof BusinessHoursSchema>;
export type AvailabilitySchedule = z.infer<typeof AvailabilityScheduleSchema>;
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;
export type PriceTier = z.infer<typeof PriceTierSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type TeamMember = z.infer<typeof TeamMemberSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type Award = z.infer<typeof AwardSchema>;
export type Testimonial = z.infer<typeof TestimonialSchema>;
export type CaseStudy = z.infer<typeof CaseStudySchema>;
export type PortfolioItem = z.infer<typeof PortfolioItemSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Package = z.infer<typeof PackageSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type CustomerSegment = z.infer<typeof CustomerSegmentSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type SEOKeyword = z.infer<typeof SEOKeywordSchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type SEORequirements = z.infer<typeof SEORequirementsSchema>;
export type FormRequirement = z.infer<typeof FormRequirementSchema>;
export type Integration = z.infer<typeof IntegrationSchema>;
export type KPI = z.infer<typeof KPISchema>;
