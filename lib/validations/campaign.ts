import { z } from 'zod';

// Email Template Validation
export const createEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255, 'Template name must be less than 255 characters'),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters'),
  body: z.string().min(1, 'Body is required'),
  variables: z.array(z.string()).default([]),
});

export const updateEmailTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(255, 'Template name must be less than 255 characters').optional(),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters').optional(),
  body: z.string().min(1, 'Body is required').optional(),
  variables: z.array(z.string()).optional(),
});

// Campaign Validation
export const campaignTypeEnum = z.enum(['one-time', 'drip', 'automation', 'ab_test'], {
  errorMap: () => ({ message: 'Invalid campaign type' }),
});

export const campaignStatusEnum = z.enum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'], {
  errorMap: () => ({ message: 'Invalid campaign status' }),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  type: campaignTypeEnum,
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters'),
  body: z.string().min(1, 'Body is required'),
  from_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  from_name: z.string().max(255, 'From name must be less than 255 characters').optional().or(z.literal('')),
  template_id: z.string().uuid('Invalid template ID').optional().or(z.literal('')),
  target_contacts: z.array(z.string().uuid('Invalid contact ID')).default([]),
  target_companies: z.array(z.string().uuid('Invalid company ID')).default([]),
  target_deals: z.array(z.string().uuid('Invalid deal ID')).default([]),
  segments: z.array(z.any()).default([]),
  scheduled_at: z.string().datetime('Invalid date format').optional().or(z.literal('')),
  is_ab_test: z.boolean().default(false),
  ab_test_variants: z.array(z.any()).default([]),
}).refine(
  (data) => {
    // At least one targeting option must be provided
    return data.target_contacts.length > 0 || 
           data.target_companies.length > 0 || 
           data.target_deals.length > 0 ||
           data.segments.length > 0;
  },
  {
    message: 'At least one targeting option (contacts, companies, deals, or segments) must be provided',
  }
);

export const updateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255, 'Campaign name must be less than 255 characters').optional(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  type: campaignTypeEnum.optional(),
  status: campaignStatusEnum.optional(),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters').optional(),
  body: z.string().min(1, 'Body is required').optional(),
  from_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  from_name: z.string().max(255, 'From name must be less than 255 characters').optional().or(z.literal('')),
  template_id: z.string().uuid('Invalid template ID').optional().or(z.literal('')),
  target_contacts: z.array(z.string().uuid('Invalid contact ID')).optional(),
  target_companies: z.array(z.string().uuid('Invalid company ID')).optional(),
  target_deals: z.array(z.string().uuid('Invalid deal ID')).optional(),
  segments: z.array(z.any()).optional(),
  scheduled_at: z.string().datetime('Invalid date format').optional().or(z.literal('')),
  is_ab_test: z.boolean().optional(),
  ab_test_variants: z.array(z.any()).optional(),
  ab_test_winner_variant: z.number().int('Variant must be an integer').min(0, 'Variant must be positive').optional(),
});

// Campaign Sequence Validation
export const campaignSequenceStatusEnum = z.enum(['active', 'paused', 'completed'], {
  errorMap: () => ({ message: 'Invalid sequence status' }),
});

export const createCampaignSequenceSchema = z.object({
  campaign_id: z.string().uuid('Invalid campaign ID'),
  step_number: z.number().int('Step number must be an integer').min(1, 'Step number must be at least 1'),
  name: z.string().min(1, 'Sequence step name is required').max(255, 'Sequence step name must be less than 255 characters'),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters'),
  body: z.string().min(1, 'Body is required'),
  template_id: z.string().uuid('Invalid template ID').optional().or(z.literal('')),
  delay_value: z.number().int('Delay value must be an integer').min(0, 'Delay value must be positive'),
  delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks'], {
    errorMap: () => ({ message: 'Invalid delay unit' }),
  }),
  delay_from: z.enum(['campaign_start', 'previous_step', 'custom_date'], {
    errorMap: () => ({ message: 'Invalid delay from' }),
  }).default('previous_step'),
  trigger_condition: z.any().optional(),
  trigger_event: z.string().max(255, 'Trigger event must be less than 255 characters').optional(),
  status: campaignSequenceStatusEnum.default('active'),
});

export const updateCampaignSequenceSchema = z.object({
  step_number: z.number().int('Step number must be an integer').min(1, 'Step number must be at least 1').optional(),
  name: z.string().min(1, 'Sequence step name is required').max(255, 'Sequence step name must be less than 255 characters').optional(),
  description: z.string().max(1000, 'Description must be less than 1000 characters').optional(),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters').optional(),
  body: z.string().min(1, 'Body is required').optional(),
  template_id: z.string().uuid('Invalid template ID').optional().or(z.literal('')),
  delay_value: z.number().int('Delay value must be an integer').min(0, 'Delay value must be positive').optional(),
  delay_unit: z.enum(['minutes', 'hours', 'days', 'weeks'], {
    errorMap: () => ({ message: 'Invalid delay unit' }),
  }).optional(),
  delay_from: z.enum(['campaign_start', 'previous_step', 'custom_date'], {
    errorMap: () => ({ message: 'Invalid delay from' }),
  }).optional(),
  trigger_condition: z.any().optional(),
  trigger_event: z.string().max(255, 'Trigger event must be less than 255 characters').optional(),
  status: campaignSequenceStatusEnum.optional(),
});

// Email validation helper
export const validateEmails = (emails: string[]): boolean => {
  const emailSchema = z.string().email('Invalid email address');
  return emails.every(email => emailSchema.safeParse(email).success);
};

// A/B Test variant validation
export const abTestVariantSchema = z.object({
  variant: z.number().int('Variant must be an integer').min(0, 'Variant must be positive'),
  subject: z.string().min(1, 'Subject is required').max(500, 'Subject must be less than 500 characters'),
  body: z.string().min(1, 'Body is required'),
  percentage: z.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage must be at most 100'),
});

// Segment validation
export const segmentSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'not_in']),
  value: z.any(),
});

// Type exports for TypeScript
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type CreateCampaignSequenceInput = z.infer<typeof createCampaignSequenceSchema>;
export type UpdateCampaignSequenceInput = z.infer<typeof updateCampaignSequenceSchema>;
export type CampaignType = z.infer<typeof campaignTypeEnum>;
export type CampaignStatus = z.infer<typeof campaignStatusEnum>;
export type CampaignSequenceStatus = z.infer<typeof campaignSequenceStatusEnum>;
