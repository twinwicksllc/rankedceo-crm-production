// =============================================================================
// lib/waas/billing-config.ts
// Phase 7.4: Static billing configuration (no server-only code)
//
// This module is importable by both server and client components.
// =============================================================================

import type { WaasPackageTier } from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// WaaS Stripe Price IDs  (set in Vercel env vars — server-side only)
// We keep the keys here as a reference; values are read from process.env
// in billing.ts (server action) which is the only place prices are used.
// ---------------------------------------------------------------------------

export const WAAS_PLAN_PRICES_ENV_KEYS = {
  hosting_only: { yearly: 'WAAS_STRIPE_PRICE_HOSTING_ONLY' },
  standard:     { monthly: 'WAAS_STRIPE_PRICE_STANDARD_MONTHLY', yearly: 'WAAS_STRIPE_PRICE_STANDARD_YEARLY' },
  premium:      { monthly: 'WAAS_STRIPE_PRICE_PREMIUM_MONTHLY',  yearly: 'WAAS_STRIPE_PRICE_PREMIUM_YEARLY' },
} as const

// ---------------------------------------------------------------------------
// Plan display metadata (safe for client components)
// ---------------------------------------------------------------------------

export interface WaasPlanDisplay {
  label:        string
  monthlyPrice: number
  yearlyPrice:  number
  features:     string[]
  highlighted:  boolean
}

export const WAAS_PLAN_DISPLAY: Record<WaasPackageTier, WaasPlanDisplay> = {
  hosting_only: {
    label:        'Hosting Only',
    monthlyPrice: 0,
    yearlyPrice:  199,   // $199/yr — annual billing only
    features: [
      'Annual billing only',
      'Managed website hosting',
      'SSL certificate',
      'Subdomain on rankedceo.com',
      'Basic site editor',
    ],
    highlighted: false,
  },
  hosting: {
    label:        'Hosting',
    monthlyPrice: 0,
    yearlyPrice:  0,
    features: [
      'Managed website hosting',
      'SSL certificate',
      'Subdomain on rankedceo.com',
      'Basic site editor',
    ],
    highlighted: false,
  },
  standard: {
    label:        'Standard',
    monthlyPrice: 39,    // $39/mo
    yearlyPrice:  399,   // $399/yr
    features: [
      'Everything in Hosting',
      'Custom domain support',
      'Audit tool (10/mo)',
      'Competitor audit reports',
      'Priority email support',
    ],
    highlighted: true,
  },
  premium: {
    label:        'Premium',
    monthlyPrice: 49,    // $49/mo
    yearlyPrice:  499,   // $499/yr
    features: [
      'Everything in Standard',
      'Unlimited audits',
      'AI-powered content insights',
      'White-label reports',
      'Dedicated account manager',
      'Phone + email support',
    ],
    highlighted: false,
  },
}
