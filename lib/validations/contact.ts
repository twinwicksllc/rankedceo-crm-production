import { z } from 'zod';

export const contactSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  company_id: z.string().optional(),
  owner_id: z.string().optional(),
  lead_score: z.number().min(0).max(100).optional(),
  tags: z.array(z.string()).optional(),
  job_title: z.string().optional(),
  linkedin_url: z.string().url('Invalid URL').optional().or(z.literal('')),
  notes: z.string().optional(),
});

export const createContactSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  company_id: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'prospect']).default('active'),
  job_title: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateContactSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(50).optional(),
  company_id: z.string().uuid().optional(),
  status: z.enum(['active', 'inactive', 'prospect']).optional(),
  job_title: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export type ContactFormData = z.infer<typeof contactSchema>;
export type CreateContactInput = z.infer<typeof createContactSchema>;
export type UpdateContactInput = z.infer<typeof updateContactSchema>;