import { z } from 'zod';

export const createCommissionRateSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  rate: z.number()
    .min(0, 'Rate must be at least 0')
    .max(100, 'Rate cannot exceed 100'),
  effective_from: z.string().min(1, 'Effective from date is required'),
  effective_to: z.string().optional().nullable(),
  is_active: z.boolean().optional().default(true),
  notes: z.string().optional().nullable(),
});

export const updateCommissionRateSchema = z.object({
  rate: z.number()
    .min(0, 'Rate must be at least 0')
    .max(100, 'Rate cannot exceed 100')
    .optional(),
  effective_from: z.string().optional(),
  effective_to: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export const createCommissionSchema = z.object({
  deal_id: z.string().uuid('Invalid deal ID'),
  user_id: z.string().uuid('Invalid user ID'),
  amount: z.number().min(0, 'Amount must be at least 0'),
  rate: z.number()
    .min(0, 'Rate must be at least 0')
    .max(100, 'Rate cannot exceed 100'),
  deal_value: z.number().min(0, 'Deal value must be at least 0'),
  status: z.enum(['pending', 'approved', 'paid', 'cancelled']).optional().default('pending'),
  notes: z.string().optional().nullable(),
});

export const updateCommissionSchema = z.object({
  amount: z.number().min(0, 'Amount must be at least 0').optional(),
  rate: z.number()
    .min(0, 'Rate must be at least 0')
    .max(100, 'Rate cannot exceed 100')
    .optional(),
  deal_value: z.number().min(0, 'Deal value must be at least 0').optional(),
  status: z.enum(['pending', 'approved', 'paid', 'cancelled']).optional(),
  paid_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type CreateCommissionRateInput = z.infer<typeof createCommissionRateSchema>;
export type UpdateCommissionRateInput = z.infer<typeof updateCommissionRateSchema>;
export type CreateCommissionInput = z.infer<typeof createCommissionSchema>;
export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;