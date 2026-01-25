import { z } from 'zod';

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
});

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  employee_count: z.number().int().min(0).optional(),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  zip_code: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive', 'prospect']).default('active'),
  description: z.string().max(5000).optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().max(100).optional().or(z.literal('')),
  employee_count: z.number().int().min(0).optional(),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  zip_code: z.string().max(20).optional(),
  status: z.enum(['active', 'inactive', 'prospect']).optional(),
  description: z.string().max(5000).optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;
export type CreateCompanyInput = z.infer<typeof createCompanySchema>;
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;