import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo-contractor' },
    update: {},
    create: {
      name: 'Demo Contractor Company',
      slug: 'demo-contractor',
      subscriptionTier: 'PRO',
      subscriptionStatus: 'ACTIVE',
      settings: {
        features: {
          websiteGeneration: true,
          contentGeneration: true,
          seoAudit: true,
          dataProcessing: false,
          customerService: false,
          apiAccess: true,
          customMCPServers: false,
        },
      },
    },
  });

  console.log('✅ Created tenant:', tenant.name);

  // Create a demo user
  const user = await prisma.user.upsert({
    where: {
      email_tenantId: {
        email: 'demo@contractor.com',
        tenantId: tenant.id,
      },
    },
    update: {},
    create: {
      email: 'demo@contractor.com',
      name: 'Demo User',
      tenantId: tenant.id,
      role: 'OWNER',
      emailVerified: new Date(),
    },
  });

  console.log('✅ Created user:', user.email);

  // Create a demo company profile
  const companyProfile = await prisma.companyProfile.create({
    data: {
      tenantId: tenant.id,
      name: 'ABC Roofing & Restoration',
      legalName: 'ABC Roofing & Restoration LLC',
      tagline: 'Your Trusted Roofing Experts',
      founded: new Date('2010-01-01'),
      industry: 'roofing',
      contact: {
        phone: '(555) 123-4567',
        emergencyPhone: '(555) 123-9999',
        email: 'info@abcroofing.com',
        website: 'https://abcroofing.com',
        socialMedia: {
          facebook: 'https://facebook.com/abcroofing',
          instagram: 'https://instagram.com/abcroofing',
        },
      },
      locations: [
        {
          id: crypto.randomUUID(),
          type: 'headquarters',
          address: {
            street: '123 Main Street',
            city: 'Denver',
            state: 'CO',
            zip: '80202',
            country: 'USA',
          },
          isPrimary: true,
        },
      ],
      hours: {
        monday: { open: '08:00', close: '17:00', isOpen: true },
        tuesday: { open: '08:00', close: '17:00', isOpen: true },
        wednesday: { open: '08:00', close: '17:00', isOpen: true },
        thursday: { open: '08:00', close: '17:00', isOpen: true },
        friday: { open: '08:00', close: '17:00', isOpen: true },
        saturday: { open: '09:00', close: '14:00', isOpen: true },
        sunday: { open: '00:00', close: '00:00', isOpen: false },
      },
      emergencyAvailable: true,
      services: [
        {
          id: crypto.randomUUID(),
          name: 'Roof Repair',
          slug: 'roof-repair',
          category: 'roofing',
          description: 'Expert roof repair services',
          detailedDescription: 'Professional roof repair for all types of damage',
          keywords: ['roof repair', 'emergency roof repair', 'leak repair'],
          pricingModel: 'quote',
          emergencyAvailable: true,
        },
      ],
      serviceAreas: [
        {
          city: 'Denver',
          state: 'CO',
          isPrimaryMarket: true,
        },
      ],
      brand: {
        voice: 'professional',
        personalityTraits: ['trustworthy', 'reliable', 'expert'],
        colors: {
          primary: '#1e40af',
          secondary: '#ffffff',
          accent: '#f59e0b',
        },
        fonts: {
          heading: 'Inter',
          body: 'Inter',
        },
        imageryStyle: 'professional',
      },
      certifications: [],
      licenses: [],
      insurance: [],
      manufacturerCerts: [],
      industryAffiliations: [],
      teamMembers: [],
      projects: [],
      testimonials: [],
      awards: [],
      caseStudies: [],
      seo: {
        primaryKeywords: ['roofing denver', 'roof repair denver'],
        secondaryKeywords: ['emergency roof repair', 'roof replacement'],
        locationKeywords: ['denver roofing', 'colorado roofing'],
        competitors: [],
        targetAudience: 'Homeowners and property managers in Denver metro area',
        uniqueSellingPropositions: [
          '24/7 emergency service',
          'Licensed and insured',
          'Lifetime warranty',
        ],
      },
      metrics: {
        yearsInBusiness: 14,
        employeesCount: 25,
        projectsCompleted: 5000,
      },
      websiteConfig: {
        features: {
          blog: true,
          onlineBooking: true,
          liveChat: true,
          financingCalculator: true,
          photoGallery: true,
          customerPortal: false,
        },
        customPages: [],
        integrations: [],
      },
    },
  });

  console.log('✅ Created company profile:', companyProfile.name);

  // Create a website generation workflow definition
  const workflowDef = await prisma.workflowDefinition.create({
    data: {
      tenantId: tenant.id,
      name: 'Website Generation - 30+ Agent',
      description: 'Comprehensive website generation with 30+ specialized agents',
      type: 'WEBSITE_GENERATION',
      version: '1.0.0',
      steps: [
        {
          id: 'discovery',
          name: 'Discovery Layer',
          type: 'parallel',
          children: [
            { id: 'business_req', name: 'Business Requirements', type: 'agent', agentRole: 'BUSINESS_REQUIREMENTS' },
            { id: 'service_def', name: 'Service Definition', type: 'agent', agentRole: 'SERVICE_DEFINITION' },
            { id: 'brand_id', name: 'Brand Identity', type: 'agent', agentRole: 'BRAND_IDENTITY' },
          ],
        },
        {
          id: 'design',
          name: 'Design Layer',
          type: 'parallel',
          dependencies: ['discovery'],
        },
        {
          id: 'content',
          name: 'Content Layer',
          type: 'parallel',
          dependencies: ['design'],
        },
        {
          id: 'code',
          name: 'Code Generation',
          type: 'sequential',
          dependencies: ['content'],
        },
        {
          id: 'quality',
          name: 'Quality Grading',
          type: 'parallel',
          dependencies: ['code'],
        },
      ],
      config: {
        maxRetries: 3,
        parallelism: 5,
        iterativeRefinement: true,
        maxIterations: 3,
      },
    },
  });

  console.log('✅ Created workflow definition:', workflowDef.name);

  console.log('🎉 Database seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
