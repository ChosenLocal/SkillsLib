import { z } from 'zod';

export const projectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().optional(),
  type: z.enum(['website', 'content', 'seo_audit', 'workflow', 'data_processing', 'customer_service']),
  companyProfileId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  maxIterations: z.number().int().min(1).max(10).optional(),
});

export type ProjectFormData = z.infer<typeof projectFormSchema>;
