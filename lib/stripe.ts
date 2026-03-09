// ============================================================
// Stripe Client — RankedCEO CRM
// ============================================================
// Server-side only. Never import this in client components.
// Uses STRIPE_SECRET_KEY from environment variables.
// ============================================================

import Stripe from 'stripe'

const stripeSecretKey = process.env.STRIPE_SECRET_KEY

if (!stripeSecretKey) {
  throw new Error(
    'Missing STRIPE_SECRET_KEY environment variable. ' +
    'Add this to your Vercel environment variables. ' +
    'Find it in Stripe Dashboard → Developers → API Keys.'
  )
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// ============================================================
// Industry → Subdomain URL mapping
// Used for post-checkout redirects back to the correct subdomain
// ============================================================
export const INDUSTRY_SUBDOMAIN_MAP: Record<string, string> = {
  hvac:       'https://hvac.rankedceo.com',
  plumbing:   'https://plumbing.rankedceo.com',
  electrical: 'https://electrical.rankedceo.com',
  smile:      'https://smile.rankedceo.com',
}

// ============================================================
// Stripe Price IDs
// These are set in Stripe Dashboard and stored here for reference.
// In production, replace placeholder values with real Stripe price IDs.
// ============================================================
export const STRIPE_PRICE_IDS = {
  hvac: {
    monthly: process.env.STRIPE_PRICE_HVAC_PRO_MONTHLY || 'price_hvac_pro_monthly',
    yearly:  process.env.STRIPE_PRICE_HVAC_PRO_YEARLY  || 'price_hvac_pro_yearly',
  },
  plumbing: {
    monthly: process.env.STRIPE_PRICE_PLUMB_PRO_MONTHLY || 'price_plumb_pro_monthly',
    yearly:  process.env.STRIPE_PRICE_PLUMB_PRO_YEARLY  || 'price_plumb_pro_yearly',
  },
  electrical: {
    monthly: process.env.STRIPE_PRICE_SPARK_PRO_MONTHLY || 'price_spark_pro_monthly',
    yearly:  process.env.STRIPE_PRICE_SPARK_PRO_YEARLY  || 'price_spark_pro_yearly',
  },
  smile: {
    monthly: process.env.STRIPE_PRICE_SMILE_PRO_MONTHLY || 'price_smile_pro_monthly',
    yearly:  process.env.STRIPE_PRICE_SMILE_PRO_YEARLY  || 'price_smile_pro_yearly',
  },
} as const

// ============================================================
// Plan display info (for checkout pages and billing dashboard)
// ============================================================
export const PLAN_INFO: Record<string, { name: string; monthlyPrice: number; yearlyPrice: number; features: string[] }> = {
  hvac: {
    name: 'HVAC Pro',
    monthlyPrice: 49,
    yearlyPrice: 499,
    features: [
      'Unlimited lead capture',
      'Automated follow-up sequences',
      'Technician scheduling & dispatch',
      'Customer portal access',
      'Analytics & reporting',
      'Priority support',
    ],
  },
  plumbing: {
    name: 'Plumb Pro',
    monthlyPrice: 49,
    yearlyPrice: 499,
    features: [
      'Unlimited lead capture',
      'Automated follow-up sequences',
      'Plumber scheduling & dispatch',
      'Customer portal access',
      'Analytics & reporting',
      'Priority support',
    ],
  },
  electrical: {
    name: 'Spark Pro',
    monthlyPrice: 49,
    yearlyPrice: 499,
    features: [
      'Unlimited lead capture',
      'Automated follow-up sequences',
      'Electrician scheduling & dispatch',
      'Customer portal access',
      'Analytics & reporting',
      'Priority support',
    ],
  },
  smile: {
    name: 'Smile MakeOver',
    monthlyPrice: 79,
    yearlyPrice: 799,
    features: [
      'Unlimited patient assessments',
      'Automated follow-up sequences',
      'Appointment scheduling',
      'Patient portal access',
      'Analytics & reporting',
      'Priority support',
    ],
  },
}