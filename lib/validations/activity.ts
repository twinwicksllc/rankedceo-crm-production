import { z } from 'zod';

export const activityTypeSchema = z.enum(['call', 'meeting', 'email', 'note', 'task']);
export const activityStatusSchema = z.enum(['pending', 'completed', 'cancelled']);

export const createActivitySchema = z.object({
  type: activityTypeSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  status: activityStatusSchema.default('completed'),
  due_date: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(1).max(1440).optional(), // Max 24 hours
  location: z.string().max(200, 'Location must be less than 200 characters').optional(),
  attendees: z.array(z.string().email()).optional(),
  metadata: z.record(z.any()).optional(),
}).refine(
  (data) => data.contact_id || data.company_id || data.deal_id,
  {
    message: 'At least one of contact_id, company_id, or deal_id is required',
    path: ['contact_id', 'company_id', 'deal_id'],
  }
);

export const updateActivitySchema = z.object({
  type: activityTypeSchema.optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: activityStatusSchema.optional(),
  due_date: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  duration_minutes: z.number().int().min(1).max(1440).optional(),
  location: z.string().max(200).optional(),
  attendees: z.array(z.string().email()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const activityFiltersSchema = z.object({
  type: activityTypeSchema.optional(),
  status: activityStatusSchema.optional(),
  contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
});

export type CreateActivityInput = z.infer<typeof createActivitySchema>;
export type UpdateActivityInput = z.infer<typeof updateActivitySchema>;
export type ActivityFilters = z.infer<typeof activityFiltersSchema>;