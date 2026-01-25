import { z } from 'zod';

export const dealStageSchema = z.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']);

export const createDealSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  stage: dealStageSchema.default('Lead'),
  value: z.number().min(0, 'Value must be a positive number'),
  win_probability: z.number().min(0).max(100).default(50),
  expected_close_date: z.string().datetime().optional(),
}).refine(
  (data) => data.contact_id || data.company_id,
  {
    message: 'At least one of contact_id or company_id is required',
    path: ['contact_id', 'company_id'],
  }
);

export const updateDealSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  pipeline_id: z.string().uuid().optional(),
  stage: dealStageSchema.optional(),
  value: z.number().min(0).optional(),
  win_probability: z.number().min(0).max(100).optional(),
  expected_close_date: z.string().datetime().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;