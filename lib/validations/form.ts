import { z } from 'zod'

export const validationRuleSchema = z.object({
  type: z.enum(['required', 'minLength', 'maxLength', 'min', 'max', 'pattern', 'email', 'url', 'phone']),
  value: z.union([z.string(), z.number()]).optional(),
  message: z.string().optional(),
})

export const fieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
  disabled: z.boolean().optional(),
})

export const createFormFieldSchema = z.object({
  field_type: z.enum([
    'text', 'textarea', 'number', 'email', 'phone', 'url',
    'date', 'time', 'datetime', 'select', 'multiselect', 'radio',
    'checkbox', 'file', 'rating', 'toggle', 'hidden', 'paragraph'
  ]),
  field_label: z.string().min(1, 'Field label is required'),
  field_key: z.string().min(1, 'Field key is required')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Field key must contain only letters, numbers, hyphens, and underscores'),
  placeholder: z.string().optional(),
  default_value: z.string().optional(),
  required: z.boolean().default(false),
  options: z.array(fieldOptionSchema).optional(),
  validation_rules: z.array(validationRuleSchema).optional(),
  order_index: z.number().int().default(0),
  width: z.enum(['full', 'half', 'third', 'quarter']).default('full'),
})

export const updateFormFieldSchema = z.object({
  field_label: z.string().min(1).optional(),
  placeholder: z.string().optional(),
  default_value: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(fieldOptionSchema).optional(),
  validation_rules: z.array(validationRuleSchema).optional(),
  order_index: z.number().int().optional(),
  width: z.enum(['full', 'half', 'third', 'quarter']).optional(),
})

export const createFormSchema = z.object({
  name: z.string().min(1, 'Form name is required'),
  description: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  thank_you_message: z.string().default('Thank you for your submission!'),
  submit_button_text: z.string().default('Submit'),
  submit_button_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#3b82f6'),
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').default('#ffffff'),
  allow_multiple_submissions: z.boolean().default(false),
  collect_email: z.boolean().default(false),
  send_notification_email: z.boolean().default(false),
  notification_emails: z.array(z.string().email()).optional(),
})

export const updateFormSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  thank_you_message: z.string().optional(),
  submit_button_text: z.string().optional(),
  submit_button_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  background_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid color format').optional(),
  allow_multiple_submissions: z.boolean().optional(),
  collect_email: z.boolean().optional(),
  send_notification_email: z.boolean().optional(),
  notification_emails: z.array(z.string().email()).optional(),
})

export const submitFormSchema = z.object({
  form_id: z.string().uuid('Invalid form ID'),
  submission_data: z.record(z.any()),
  recaptcha_token: z.string().optional(),
})

export const formFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

export const submissionFiltersSchema = z.object({
  search: z.string().optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
})
