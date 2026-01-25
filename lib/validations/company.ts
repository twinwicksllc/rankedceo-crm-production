import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  company_size: z.string().max(50).optional().or(z.literal('')),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(255).optional().or(z.literal('')),
  city: z.string().max(100).optional().or(z.literal('')),
  state: z.string().max(100).optional().or(z.literal('')),
  country: z.string().max(100).optional().or(z.literal('')),
  postal_code: z.string().max(20).optional().or(z.literal('')),
  status: z.enum(['active', 'inactive', 'prospect']).default('active'),
  notes: z.string().optional().or(z.literal('')),
})

export type CompanyFormData = z.infer<typeof companySchema>
