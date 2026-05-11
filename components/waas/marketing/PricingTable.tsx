'use client'

// =============================================================================
// components/waas/marketing/PricingTable.tsx
// Phase 8.1 — WaaS public-facing pricing table
//
// Shows all 4 WaaS tiers with feature comparison and CTA to the audit funnel.
// Renders as a standalone section; used by app/waas-plans/page.tsx.
// =============================================================================

import { useState } from 'react'
import Link from 'next/link'
import { WAAS_PLAN_DISPLAY } from '@/lib/waas/billing-config'
import type { WaasPackageTier } from '@/lib/waas/types'

// ---------------------------------------------------------------------------
// Tier ordering for display
// ---------------------------------------------------------------------------

const TIER_ORDER: WaasPackageTier[] = ['hosting', 'hosting_only', 'standard', 'premium']

// Which tier to badge as "Most Popular"
const POPULAR_TIER: WaasPackageTier = 'standard'

// Feature comparison matrix — rows shown in the feature grid below the cards
const FEATURE_ROWS: { label: string; tiers: Partial<Record<WaasPackageTier, string | boolean>> }[] = [
  {
    label: 'Managed Hosting',
    tiers: { hosting: true, hosting_only: true, standard: true, premium: true },
  },
  {
    label: 'SSL Certificate',
    tiers: { hosting: true, hosting_only: true, standard: true, premium: true },
  },
  {
    label: 'Subdomain (rankedceo.com)',
    tiers: { hosting: true, hosting_only: true, standard: true, premium: true },
  },
  {
    label: 'Client Site Editor',
    tiers: { hosting: true, hosting_only: true, standard: true, premium: true },
  },
  {
    label: 'Custom Domain',
    tiers: { hosting: false, hosting_only: false, standard: true, premium: true },
  },
  {
    label: 'SEO Audit Tool',
    tiers: { hosting: false, hosting_only: false, standard: '10 / mo', premium: 'Unlimited' },
  },
  {
    label: 'Competitor Audit Reports',
    tiers: { hosting: false, hosting_only: false, standard: true, premium: true },
  },
  {
    label: 'AI-Powered Content Insights',
    tiers: { hosting: false, hosting_only: false, standard: false, premium: true },
  },
  {
    label: 'White-Label Reports',
    tiers: { hosting: false, hosting_only: false, standard: false, premium: true },
  },
  {
    label: 'Dedicated Account Manager',
    tiers: { hosting: false, hosting_only: false, standard: false, premium: true },
  },
  {
    label: 'Support',
    tiers: { hosting: 'Email', hosting_only: 'Email', standard: 'Priority Email', premium: 'Phone + Email' },
  },
]

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" className="fill-emerald-100" />
      <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 ${className}`} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" className="fill-slate-100" />
      <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function FeatureValue({ value }: { value: string | boolean | undefined }) {
  if (value === true)  return <CheckIcon />
  if (!value)          return <XIcon />
  return <span className="text-xs font-medium text-slate-700">{value}</span>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PricingTable() {
  const [interval, setInterval] = useState<'month' | 'year'>('year')

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block mb-4 text-xs font-semibold tracking-widest uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
            Simple Pricing
          </span>
          <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
            Your AI-built website, fully managed
          </h2>
          <p className="text-lg text-slate-500 max-w-2xl mx-auto">
            From free hosting to a full AI-powered marketing suite — pick the plan that fits your business today, upgrade anytime.
          </p>

          {/* Billing toggle */}
          <div className="mt-8 inline-flex items-center gap-3 bg-slate-100 rounded-full p-1">
            <button
              onClick={() => setInterval('month')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                interval === 'month'
                  ? 'bg-white shadow text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval('year')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-2 ${
                interval === 'year'
                  ? 'bg-white shadow text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Annual
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                Save 15%
              </span>
            </button>
          </div>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {TIER_ORDER.map((tier) => {
            const plan      = WAAS_PLAN_DISPLAY[tier]
            const isPopular = tier === POPULAR_TIER
            const isFree    = tier === 'hosting'
            const isAnnualOnly = tier === 'hosting_only'

            // Price display
            let priceLabel = 'Free'
            let priceSub   = 'always free'
            if (tier === 'hosting_only') {
              priceLabel = '$199'
              priceSub   = '/ year · annual only'
            } else if (tier === 'standard' || tier === 'premium') {
              const p = interval === 'year' ? plan.yearlyPrice : plan.monthlyPrice
              priceLabel = `$${p}`
              priceSub   = interval === 'year' ? '/ year' : '/ month'
            }

            return (
              <div
                key={tier}
                className={`relative flex flex-col rounded-2xl border p-6 transition-shadow ${
                  isPopular
                    ? 'border-blue-500 shadow-xl ring-2 ring-blue-500/20'
                    : 'border-slate-200 shadow-sm hover:shadow-md'
                } bg-white`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-block bg-blue-600 text-white text-[11px] font-bold tracking-wider uppercase px-4 py-1 rounded-full shadow">
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Annual-only badge */}
                {isAnnualOnly && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-block bg-teal-600 text-white text-[11px] font-bold tracking-wider uppercase px-4 py-1 rounded-full shadow">
                      Annual Only
                    </span>
                  </div>
                )}

                {/* Tier name */}
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
                    {plan.label}
                  </p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-slate-900 leading-none">{priceLabel}</span>
                    <span className="text-sm text-slate-400 mb-1">{priceSub}</span>
                  </div>
                  {/* Annual savings note */}
                  {(tier === 'standard' || tier === 'premium') && interval === 'year' && (
                    <p className="mt-1 text-xs text-emerald-600 font-medium">
                      Save ${(plan.monthlyPrice * 12) - plan.yearlyPrice}/yr vs monthly
                    </p>
                  )}
                </div>

                {/* Feature list */}
                <ul className="flex-1 space-y-2.5 mb-6">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2 text-sm text-slate-600">
                      <CheckIcon className="mt-0.5 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={isFree ? '/get-started' : `/get-started?plan=${tier}&interval=${isAnnualOnly ? 'year' : interval}`}
                  className={`block text-center py-2.5 px-4 rounded-xl text-sm font-semibold transition-all ${
                    isPopular
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                      : isFree
                        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        : 'bg-slate-900 hover:bg-slate-700 text-white'
                  }`}
                >
                  {isFree ? 'Get started free' : 'Start your audit'}
                </Link>
              </div>
            )
          })}
        </div>

        {/* Feature comparison table — desktop */}
        <div className="hidden lg:block rounded-2xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left py-4 px-6 font-semibold text-slate-600 w-1/3">Feature</th>
                {TIER_ORDER.map((tier) => (
                  <th key={tier} className="py-4 px-4 font-semibold text-slate-700 text-center">
                    {WAAS_PLAN_DISPLAY[tier].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row, i) => (
                <tr
                  key={row.label}
                  className={`border-b border-slate-100 ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                >
                  <td className="py-3.5 px-6 text-slate-600 font-medium">{row.label}</td>
                  {TIER_ORDER.map((tier) => (
                    <td key={tier} className="py-3.5 px-4 text-center">
                      <div className="flex justify-center">
                        <FeatureValue value={row.tiers[tier]} />
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ / trust strip */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
          {[
            { icon: '🔒', title: 'No contracts', body: 'Cancel or switch plans anytime. No hidden fees.' },
            { icon: '⚡', title: 'Live in 48 hours', body: 'We build and launch your AI-generated site in 2 business days.' },
            { icon: '🤝', title: 'White-glove onboarding', body: 'Every plan includes a setup call with your dedicated account team.' },
          ].map(({ icon, title, body }) => (
            <div key={title} className="flex flex-col items-center gap-2 px-4">
              <span className="text-3xl">{icon}</span>
              <p className="font-semibold text-slate-800">{title}</p>
              <p className="text-sm text-slate-500">{body}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl py-12 px-8 shadow-xl">
          <h3 className="text-2xl font-extrabold text-white mb-3">
            Not sure which plan is right for you?
          </h3>
          <p className="text-blue-100 mb-8 max-w-lg mx-auto">
            Run a free AI audit of your current website — we&apos;ll recommend the best plan based on your actual SEO gaps and growth goals.
          </p>
          <Link
            href="/get-started"
            className="inline-flex items-center gap-2 bg-white text-blue-700 font-bold px-8 py-3.5 rounded-xl shadow hover:shadow-md hover:bg-blue-50 transition-all"
          >
            Get your free audit
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
