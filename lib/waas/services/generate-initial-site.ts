// =============================================================================
// generateInitialSiteFromTemplate — PR #96 (GitHub #98 base)
//
// Two-tier site generation seeded by the client's chosen template.
//
//   Tier 1 (synchronous, instant)
//     • Reads the tenant's selected template slug from tenant_site_config
//     • Falls back to industry-recommended template if none is stored
//     • Builds a fully-populated single GeneratedSiteVariant deterministically
//       using template sections + business profile data
//     • Enriches content with trade-specific Industry Content Packs:
//         – Services list (falls back to pack defaults when intake is sparse)
//         – FAQ items (pack FAQs seeded first, strategy items appended)
//         – Hero eyebrow copy (pack strategy-keyed patterns)
//         – Trust signals (pack-supplied, shown in trust bar section)
//         – SEO keyword clusters (merged into keyPhrases)
//     • Writes variant_index=0, status='selected' to tenant_site_variants
//     • Records initial_build_completed_at in tenant_site_config
//
//   Tier 2 (asynchronous, fire-and-forget)
//     • Calls Gemini to enhance/rewrite the Tier 1 variant copy
//     • Uses template seo_strategy to weight keyword placement instructions
//     • Uses template aesthetic/mood to tune tone directives
//     • On success: overwrites the variant row with AI copy
//     • Records ai_enhancement_completed_at + sets ai_enhancement_status
//     • Schema-gap resilient — silently skips if Tier 2 columns are absent
//
// The Tier 1 path is synchronous so the editor is instantly available after
// onboarding submit.  Tier 2 fires in the background and upgrades the copy
// without any user-facing wait.
// =============================================================================
import { createClient } from '@supabase/supabase-js'
import { getTemplate, ALL_TEMPLATES } from '@/lib/waas/templates/registry'
import { recommendTemplates } from '@/lib/waas/services/template-recommender'
import { getContentPack } from '@/lib/waas/content-packs'
import type { WaasTenant, GeneratedSiteVariant } from '@/lib/waas/types'
import type {
  SectionConfig,
  SectionId,
  SiteTemplate,
  SeoStrategy,
} from '@/lib/waas/templates/types'
import type {
  AboutSectionContent,
  FAQSectionContent,
  HowItWorksSectionContent,
} from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL    = 'gemini-2.5-pro'

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface InitialSiteBuildResult {
  /** true when Tier 1 deterministic build succeeded and was persisted */
  tier1Success: boolean
  /** true when Gemini enhancement has been dispatched (will complete async) */
  tier2Dispatched: boolean
  /** The template slug that was used */
  templateSlug: string
  /** Any non-fatal message for diagnostics */
  message?: string
}

// ---------------------------------------------------------------------------
// Internal generation profile (same shape as generate-site-content)
// ---------------------------------------------------------------------------

interface GenerationProfile {
  businessName:      string
  trade:             string
  industry:          string
  location:          string
  usp:               string
  tagline:           string
  primaryCta:        string
  aboutNarrative:    string
  valuePropositions: string[]
  keyPhrases:        string[]
  targetAudience:    string
  tone:              string
  serviceArea:       string
  /**
   * Services list — populated from intake data when available,
   * otherwise falls back to the industry content pack defaults.
   */
  services:          string[]
  /**
   * Resolved display name for this trade from the content pack
   * (e.g. "Plumbing Services"). Used in section headlines.
   */
  tradeDisplayName:  string
  /**
   * Trust signals from the content pack — short strings shown in
   * the trust / stats bar section.
   */
  trustSignals:      string[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase admin env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function extractList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/[\n,;|]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function cloneSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.map((s) => ({
    ...s,
    config:  { ...s.config },
    content: s.content ? { ...s.content } : undefined,
  }))
}

function upsertSection(
  sections: SectionConfig[],
  id:       SectionId,
  patch:    Partial<SectionConfig>,
): SectionConfig[] {
  const idx = sections.findIndex((s) => s.section === id)
  if (idx >= 0) {
    const existing = sections[idx]
    sections[idx] = {
      ...existing,
      ...patch,
      config:  { ...existing.config,  ...(patch.config  ?? {}) },
      content: patch.content !== undefined ? patch.content : existing.content,
    }
    return sections
  }
  const nextOrder = Math.max(0, ...sections.map((s) => s.order)) + 1
  sections.push({
    section: id,
    enabled: patch.enabled ?? true,
    order:   patch.order   ?? nextOrder,
    config:  patch.config  ?? {},
    content: patch.content,
  })
  return sections
}

function normalizeOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }))
}

// ---------------------------------------------------------------------------
// Build generation profile from WaasTenant
// ---------------------------------------------------------------------------

function buildProfile(tenant: WaasTenant): GenerationProfile {
  const brand   = asRecord(tenant.brand_config)
  const content = asRecord(brand.content)
  const seo     = asRecord(brand.seo)
  const intake  = asRecord(brand.intake_profile)

  const businessName =
    typeof brand.business_name === 'string' && brand.business_name.trim()
      ? brand.business_name.trim()
      : (tenant.legal_name ?? 'Your Business')

  const trade = tenant.primary_trade ?? tenant.target_industry ?? 'Local service'

  // ── Industry content pack ────────────────────────────────────────────────
  // Provides trade-specific fallbacks for services, keywords, and trust
  // signals when the tenant's own intake profile is sparse.
  const pack = getContentPack(trade)

  // Services: intake data wins; pack defaults fill the gap
  const intakeServices = extractList(intake.services_offered)
  const services =
    intakeServices.length > 0
      ? intakeServices
      : pack.defaultServices.slice(0, 6).map((s) => s.title)

  // SEO key phrases: merge tenant phrases with pack terms (deduplicated)
  const intakeKeyPhrases = extractList(seo.key_phrases)
  const packKeyPhrases   = [...pack.seoKeywords.headTerms, ...pack.seoKeywords.midTail.slice(0, 3)]
  const keyPhrases =
    intakeKeyPhrases.length > 0
      ? [
          ...intakeKeyPhrases,
          ...packKeyPhrases.filter((kw) => !intakeKeyPhrases.includes(kw)),
        ].slice(0, 12)
      : packKeyPhrases.slice(0, 8)

  return {
    businessName,
    trade,
    industry:          tenant.target_industry ?? trade,
    location:          tenant.target_location
      ?? ([tenant.city, tenant.state].filter(Boolean).join(', ') || 'your local area'),
    usp:               typeof tenant.usp === 'string' && tenant.usp.trim()
      ? tenant.usp.trim()
      : (typeof content.usp === 'string' && content.usp.trim()
        ? content.usp.trim()
        : 'Trusted local service with fast response'),
    tagline:           typeof brand.tagline === 'string' && brand.tagline.trim()
      ? brand.tagline.trim()
      : '',
    primaryCta:        typeof content.primary_cta === 'string' && content.primary_cta.trim()
      ? content.primary_cta.trim()
      : 'Book a Free Estimate',
    aboutNarrative:    typeof content.about_narrative === 'string' && content.about_narrative.trim()
      ? content.about_narrative.trim()
      : `${businessName} serves clients in ${tenant.target_location ?? 'the local area'} with reliable ${trade.toLowerCase()} services.`,
    valuePropositions: extractList(content.value_propositions),
    keyPhrases,
    targetAudience:    typeof intake.target_audience === 'string'
      ? intake.target_audience
      : 'Homeowners and local businesses',
    tone:              typeof brand.tone === 'string' && brand.tone.trim()
      ? brand.tone.trim()
      : 'Professional',
    serviceArea:       typeof seo.service_area === 'string' && seo.service_area.trim()
      ? seo.service_area.trim()
      : (tenant.target_location ?? 'Local area'),
    services,
    tradeDisplayName:  pack.displayName,
    trustSignals:      pack.trustSignals,
  }
}

// ---------------------------------------------------------------------------
// Section content builders
// ---------------------------------------------------------------------------

function buildFaqContent(
  profile:  GenerationProfile,
  strategy: SeoStrategy,
): FAQSectionContent {
  const propositions = profile.valuePropositions.slice(0, 3)

  // Seed with pack FAQs (up to 3 most relevant ones) then add strategy items
  const pack     = getContentPack(profile.trade)
  const packFaqs = pack.defaultFaqs.slice(0, 3)

  const items: FAQSectionContent['items'] = [
    // Always include pack FAQs first — they're trade-specific and high-quality
    ...packFaqs.map((faq) => ({
      question: faq.question,
      answer:   faq.answer,
    })),
    {
      question: `Do you cover ${profile.serviceArea} and the surrounding area?`,
      answer:   `Yes. ${profile.businessName} provides service across ${profile.serviceArea} and nearby areas.`,
    },
    {
      question: 'How soon can you get started?',
      answer:   'We confirm availability quickly and schedule based on urgency and location.',
    },
  ]

  if (strategy === 'emergency') {
    items.push({
      question: 'Do you offer 24/7 emergency service?',
      answer:   `Yes — ${profile.businessName} responds to emergency calls day and night.`,
    })
  } else if (strategy === 'consultative') {
    items.push({
      question: 'What does your process look like from start to finish?',
      answer:   'We start with a consultation, then produce a clear plan with transparent pricing before any work begins.',
    })
  } else {
    items.push({
      question: 'How does pricing and estimates work?',
      answer:   'You receive a clear scope and pricing breakdown before any commitment.',
    })
  }

  if (propositions.length > 0) {
    items.push({
      question: `Why choose ${profile.businessName} over other providers?`,
      answer:   propositions.join(' • '),
    })
  }

  return {
    eyebrow:  'FAQ',
    headline: 'Common Questions',
    intro:    `Quick answers about our ${profile.tradeDisplayName.toLowerCase()}.`,
    items,
  }
}

function buildProcessContent(
  profile:  GenerationProfile,
  strategy: SeoStrategy,
): HowItWorksSectionContent {
  const steps =
    strategy === 'emergency'
      ? [
          { title: 'Call or Text',     description: `Reach us any time — we respond to ${profile.location} emergencies fast.` },
          { title: 'Rapid Assessment', description: 'We diagnose the problem and confirm a clear fix with pricing upfront.' },
          { title: 'Same-Day Resolve', description: 'Our team completes the work and ensures everything is safe and sealed.' },
        ]
      : strategy === 'consultative'
      ? [
          { title: 'Initial Consult',  description: `Tell us your goals and we'll map the best approach for ${profile.location}.` },
          { title: 'Tailored Plan',    description: 'We produce a step-by-step plan with timeline and transparent costs.' },
          { title: 'Delivered Right',  description: 'Work is completed to spec and backed by our quality guarantee.' },
        ]
      : [
          { title: 'Reach Out',   description: `Tell us about your project in ${profile.location}.` },
          { title: 'Plan & Quote', description: 'We walk through options, timelines, and clear pricing.' },
          { title: 'Deliver',      description: 'Our team completes the work and confirms everything meets expectations.' },
        ]

  return {
    eyebrow:  'How It Works',
    headline: `Our ${profile.trade} Process`,
    intro:    'Simple steps from first contact to completed project.',
    steps,
  }
}

// ---------------------------------------------------------------------------
// SEO strategy → headline/copy tone instructions (used in Tier 1 copy tuning)
// ---------------------------------------------------------------------------

interface StrategyDirectives {
  heroEyebrow:     string
  heroPreamble:    string
  servicesEyebrow: string
  trustHeadline:   string
  bookingEyebrow:  string
  bookingHeadline: string
}

function getStrategyDirectives(
  strategy: SeoStrategy,
  profile:  GenerationProfile,
): StrategyDirectives {
  switch (strategy) {
    case 'emergency':
      return {
        heroEyebrow:     `24/7 ${profile.trade} — ${profile.location}`,
        heroPreamble:    `Fast response when it matters most. `,
        servicesEyebrow: 'Emergency & Routine Services',
        trustHeadline:   `Trusted for rapid ${profile.trade.toLowerCase()} response across ${profile.location}`,
        bookingEyebrow:  'Book Now — Available 24/7',
        bookingHeadline: 'Get Immediate Help',
      }
    case 'trust-authority':
      return {
        heroEyebrow:     `Certified ${profile.trade} Specialists`,
        heroPreamble:    '',
        servicesEyebrow: 'Professional Services',
        trustHeadline:   `Certified, reviewed, and recommended in ${profile.location}`,
        bookingEyebrow:  'Start Your Project',
        bookingHeadline: 'Schedule a Consultation',
      }
    case 'visual-portfolio':
      return {
        heroEyebrow:     `${profile.trade} Portfolio — ${profile.location}`,
        heroPreamble:    '',
        servicesEyebrow: 'Our Work',
        trustHeadline:   `${profile.businessName} — results you can see`,
        bookingEyebrow:  'Ready to Start?',
        bookingHeadline: 'Request a Project Quote',
      }
    case 'consultative':
      return {
        heroEyebrow:     `${profile.trade} Experts`,
        heroPreamble:    '',
        servicesEyebrow: 'How We Help',
        trustHeadline:   `Trusted guidance for ${profile.trade.toLowerCase()} projects in ${profile.location}`,
        bookingEyebrow:  'Let\'s Talk',
        bookingHeadline: 'Book a Free Consultation',
      }
    case 'conversion':
      return {
        heroEyebrow:     `Get Your Free Estimate Today`,
        heroPreamble:    '',
        servicesEyebrow: 'Services & Pricing',
        trustHeadline:   `Transparent pricing. Fast results. ${profile.location}.`,
        bookingEyebrow:  'Claim Your Free Estimate',
        bookingHeadline: 'Book Now — No Obligation',
      }
    case 'local-service':
    default:
      return {
        heroEyebrow:     `${profile.trade} — ${profile.location}`,
        heroPreamble:    '',
        servicesEyebrow: 'Our Services',
        trustHeadline:   `Trusted by homeowners across ${profile.location}`,
        bookingEyebrow:  'Get Started',
        bookingHeadline: 'Schedule Your Consultation',
      }
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — Deterministic build
// ---------------------------------------------------------------------------

function buildTier1Variant(
  tenant:   WaasTenant,
  template: SiteTemplate,
): GeneratedSiteVariant {
  const profile    = buildProfile(tenant)
  const strategy   = template.seo_strategy
  const directives = getStrategyDirectives(strategy, profile)

  // ── Service items ─────────────────────────────────────────────────────────
  // Prefer rich pack descriptions when service titles match pack defaults;
  // fall back to generic description for custom tenant-supplied services.
  const pack = getContentPack(profile.trade)
  const packServiceMap = new Map(
    pack.defaultServices.map((s) => [s.title.toLowerCase(), s.description]),
  )

  const services = profile.services.length > 0
    ? profile.services.slice(0, 6).map((title) => ({
        title,
        description:
          packServiceMap.get(title.toLowerCase())
          ?? `${title} provided by ${profile.businessName} in ${profile.location}.`,
      }))
    : undefined

  // ── Hero copy enrichment ──────────────────────────────────────────────────
  // Pack provides strategy-keyed hero copy patterns.  We use the pack's
  // eyebrow as a richer location-aware eyebrow when the tenant has no tagline.
  const packHero = pack.heroCopyPatterns[strategy as keyof typeof pack.heroCopyPatterns]
    ?? pack.heroCopyPatterns['standard']

  const heroEyebrow =
    directives.heroEyebrow !== `${profile.trade} — ${profile.location}` &&
    directives.heroEyebrow !== `${profile.trade} Experts`
      ? directives.heroEyebrow       // strategy directive wins if it's specific
      : packHero
        ? `${packHero.eyebrow} — ${profile.location}`
        : directives.heroEyebrow

  const aboutContent: AboutSectionContent = {
    eyebrow:    'About Us',
    headline:   `Why ${profile.businessName}?`,
    body:       profile.aboutNarrative,
    highlights: profile.valuePropositions.slice(0, 4),
  }

  let sections = cloneSections(template.default_layout_json)

  // ── Hero ──────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'hero', {
    enabled: true,
    content: {
      eyebrow:          heroEyebrow,
      headline:         profile.usp,
      subheadline:      `${directives.heroPreamble}${
        profile.tagline
          ? profile.tagline
          : `Serving ${profile.location} — ${profile.businessName} delivers reliable results.`
      }`,
      primaryCtaLabel:  profile.primaryCta,
    },
  })

  // ── Services ──────────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'services', {
    enabled: true,
    content: {
      eyebrow:     directives.servicesEyebrow,
      headline:    profile.tradeDisplayName,
      subheadline: `Built for ${profile.targetAudience} in ${profile.location}.`,
      items:       services,
    },
  })

  // ── Trust ─────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'trust', {
    enabled: true,
    content: {
      headline:    directives.trustHeadline,
      subheadline: profile.valuePropositions[0] ?? profile.trustSignals[0] ?? undefined,
      items:       profile.trustSignals.map((signal) => ({ label: signal })),
    },
  })

  // ── About ─────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'about', {
    enabled: true,
    content: aboutContent,
  })

  // ── FAQ ───────────────────────────────────────────────────────────────────
  // Always populate content; let template default determine enabled/disabled
  sections = upsertSection(sections, 'faq', {
    content: buildFaqContent(profile, strategy),
  })

  // ── How It Works ──────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'how-it-works', {
    content: buildProcessContent(profile, strategy),
  })

  // ── Reviews ───────────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'reviews', {
    enabled: true,
    content: {
      headline:    'What Our Customers Say',
      subheadline: `${profile.businessName} is built on repeat business and referrals.`,
    },
  })

  // ── Booking ───────────────────────────────────────────────────────────────
  sections = upsertSection(sections, 'booking', {
    enabled: true,
    content: {
      eyebrow:         directives.bookingEyebrow,
      headline:        directives.bookingHeadline,
      subheadline:     'Pick a time that works for you — we handle the rest.',
      primaryCtaLabel: profile.primaryCta,
    },
  })

  // Build label and rationale from template metadata
  const variantLabel    = `${template.name} — ${profile.trade}`
  const variantRationale = [
    `Generated using the "${template.name}" template (${template.seo_strategy} SEO strategy).`,
    template.mood ? `Aesthetic: ${template.mood}.` : '',
    `Tuned for ${profile.trade} businesses in ${profile.location}.`,
  ].filter(Boolean).join(' ')

  return {
    variantIndex:    0,
    variantLabel,
    variantRationale,
    templateSlug:    template.slug,
    sections:        normalizeOrder(sections),
  }
}

// ---------------------------------------------------------------------------
// Resolve template — from stored slug, fallback to industry recommendation
// ---------------------------------------------------------------------------

async function resolveTemplate(
  tenantId: string,
  tenant:   WaasTenant,
): Promise<SiteTemplate> {
  // 1. Try to read the client's selection from tenant_site_config
  try {
    const supabase = getAdminClient()
    const { data: configRow } = await supabase
      .from('tenant_site_config')
      .select('client_selected_template_slug')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    const storedSlug =
      configRow &&
      typeof (configRow as Record<string, unknown>).client_selected_template_slug === 'string'
        ? ((configRow as Record<string, unknown>).client_selected_template_slug as string)
        : null

    if (storedSlug) {
      try {
        return getTemplate(storedSlug)
      } catch {
        // Unknown slug — fall through to recommendation
      }
    }
  } catch {
    // DB unavailable — fall through
  }

  // 2. Industry recommendation fallback
  const brand = asRecord(tenant.brand_config)
  const recommendations = await recommendTemplates(
    {
      businessName:     typeof brand.business_name === 'string' ? brand.business_name : 'Business',
      industry:         tenant.primary_trade ?? tenant.target_industry ?? null,
      location:         tenant.target_location ?? null,
      usp:              tenant.usp ?? null,
      financingEnabled: Boolean(tenant.financing_enabled),
      hasBooking:       Boolean(tenant.calendly_url),
      tone:             typeof brand.tone === 'string' ? brand.tone : null,
    },
    ALL_TEMPLATES,
  ).catch(() => [])

  if (recommendations.length > 0) {
    try {
      return getTemplate(recommendations[0].templateSlug)
    } catch {
      // Recommendation returned unknown slug
    }
  }

  // 3. Hard fallback — 'modern'
  return getTemplate('modern')
}

// ---------------------------------------------------------------------------
// Persist Tier 1 variant to tenant_site_variants
// ---------------------------------------------------------------------------

async function persistTier1Variant(
  tenantId: string,
  variant:  GeneratedSiteVariant,
): Promise<void> {
  const supabase = getAdminClient()
  const now      = new Date().toISOString()

  const { error: upsertError } = await supabase
    .from('tenant_site_variants')
    .upsert(
      {
        tenant_id:        tenantId,
        variant_index:    variant.variantIndex,
        variant_label:    variant.variantLabel,
        variant_rationale: variant.variantRationale,
        template_slug:    variant.templateSlug,
        sections_json:    variant.sections,
        generation_notes: 'tier1_deterministic',
        status:           'selected',
        generated_at:     now,
        updated_at:       now,
      },
      { onConflict: 'tenant_id,variant_index' },
    )

  if (upsertError) {
    const msg = upsertError.message ?? ''
    const isSchemaGap =
      /could not find.*table.*tenant_site_variants/i.test(msg) ||
      /relation.*tenant_site_variants.*does not exist/i.test(msg)
    if (!isSchemaGap) {
      throw new Error(upsertError.message)
    }
    // Schema gap — silently skip
    return
  }

  // Mark initial_build_completed_at in tenant_site_config (schema-gap safe)
  await supabase
    .from('tenant_site_config')
    .upsert(
      {
        tenant_id:                  tenantId,
        initial_build_completed_at: now,
        updated_at:                 now,
      },
      { onConflict: 'tenant_id' },
    )
    .then(({ error: _configErr }: { error: unknown }) => {
      if (_configErr) {
        // Missing column is fine — migration may not be applied yet
      }
    })
}

// ---------------------------------------------------------------------------
// Tier 2 — Gemini AI enhancement (runs after Tier 1 is persisted)
// ---------------------------------------------------------------------------

function buildGeminiPrompt(
  profile:  GenerationProfile,
  template: SiteTemplate,
  tier1:    GeneratedSiteVariant,
): string {
  const strategyInstructions: Record<SeoStrategy, string> = {
    'local-service':     'Weight "[City] [Trade]" keyword clusters throughout headlines and subheadlines. Ensure NAP-style information is present in the hero and about sections.',
    'trust-authority':   'Emphasise credentials, certifications, years of experience, and E-E-A-T signals. Every section should reinforce expertise and trustworthiness.',
    'visual-portfolio':  'Lead with project outcomes and visual language. Hero and services copy should invoke imagery of completed work and transformation.',
    'emergency':         'Use urgency language throughout: "fast", "24/7", "same-day". Every CTA must convey immediacy. Hero headline must include a strong availability signal.',
    'consultative':      'Use a consultative, educational tone. FAQ and How-It-Works sections must be detailed and step-oriented. Avoid salesy language.',
    'conversion':        'Maximise CTA density. Every section should include a micro-conversion hook. Use offer language ("free estimate", "no obligation") naturally.',
  }

  const toneInstructions = [
    template.mood && `The template aesthetic is "${template.mood}". Tone the copy to match.`,
    profile.tone && profile.tone !== 'Professional' && `The business prefers a "${profile.tone}" voice.`,
  ].filter(Boolean).join(' ')

  return [
    'You are an expert copywriter for local service business websites.',
    'Enhance the copy in the provided site variant JSON.',
    'Return ONLY valid JSON matching the input structure exactly — same keys, same section IDs.',
    'Do NOT add or remove sections. Do NOT change enabled/order values.',
    'Do NOT invent factual claims, certifications, or specific numbers unless they appear in the business inputs.',
    '',
    `SEO strategy: ${template.seo_strategy}`,
    strategyInstructions[template.seo_strategy],
    toneInstructions,
    '',
    `Business name: ${profile.businessName}`,
    `Trade: ${profile.trade}`,
    `Location: ${profile.location}`,
    `Service area: ${profile.serviceArea}`,
    `Target audience: ${profile.targetAudience}`,
    `USP: ${profile.usp}`,
    `Tagline: ${profile.tagline || 'none provided'}`,
    `Primary CTA: ${profile.primaryCta}`,
    `About narrative: ${profile.aboutNarrative}`,
    `Value propositions: ${profile.valuePropositions.join(' | ') || 'none provided'}`,
    `Key SEO phrases: ${profile.keyPhrases.join(' | ') || 'none provided'}`,
    `Services offered: ${profile.services.join(' | ') || 'none provided'}`,
    '',
    'Current variant JSON to enhance:',
    JSON.stringify(tier1, null, 2),
  ].filter(Boolean).join('\n')
}

function sanitizeSections(value: unknown): SectionConfig[] {
  if (!Array.isArray(value)) return []
  const allowed: SectionId[] = [
    'hero', 'services', 'trust', 'financing',
    'booking', 'reviews', 'about', 'faq', 'how-it-works', 'gallery',
  ]
  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.section === 'string' && allowed.includes(row.section as SectionId))
    .map((row, index) => ({
      section: row.section as SectionId,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
      order:   typeof row.order   === 'number'  ? row.order   : index + 1,
      config:  row.config && typeof row.config === 'object'
        ? (row.config as Record<string, unknown>)
        : {},
      content: row.content && typeof row.content === 'object'
        ? (row.content as Record<string, unknown>)
        : undefined,
    }))
}

async function runGeminiEnhancement(
  tenantId: string,
  tier1:    GeneratedSiteVariant,
  profile:  GenerationProfile,
  template: SiteTemplate,
): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return

  const supabase = getAdminClient()
  const now      = new Date().toISOString()

  // Record that we started
  await supabase
    .from('tenant_site_config')
    .update({ ai_enhancement_status: 'in_progress', updated_at: now })
    .eq('tenant_id', tenantId)
    .then(({ error: _e2 }: { error: unknown }) => {
      if (_e2) { /* column not yet migrated — skip */ }
    })

  try {
    const prompt = buildGeminiPrompt(profile, template, tier1)

    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:      0.55,
            maxOutputTokens:  8192,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`)

    const data = await response.json() as Record<string, unknown>
    const text =
      (
        (data?.candidates as Array<Record<string, unknown>> | undefined)?.[0]
          ?.content as Record<string, unknown> | undefined
      )?.parts
      ? ((
          (data?.candidates as Array<Record<string, unknown>>)[0]
            .content as Record<string, unknown>
        ).parts as Array<Record<string, unknown>>)[0]?.text
      : undefined

    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Gemini returned empty response')
    }

    // Parse and validate
    const cleaned = text.trim().replace(/```json\n?|\n?```/g, '')
    const parsed  = JSON.parse(cleaned) as Record<string, unknown>

    const enhancedSections = sanitizeSections(parsed.sections ?? parsed)
    if (enhancedSections.length < 3) {
      throw new Error('Gemini returned fewer than 3 sections — discarding')
    }

    // Persist enhanced variant
    const enhancedNow = new Date().toISOString()
    await supabase
      .from('tenant_site_variants')
      .update({
        sections_json:    normalizeOrder(enhancedSections),
        variant_label:    typeof parsed.variantLabel    === 'string' ? parsed.variantLabel    : tier1.variantLabel,
        variant_rationale: typeof parsed.variantRationale === 'string' ? parsed.variantRationale : tier1.variantRationale,
        generation_notes: 'tier2_gemini',
        updated_at:       enhancedNow,
      })
      .eq('tenant_id',   tenantId)
      .eq('variant_index', tier1.variantIndex)

    // Update status columns (schema-gap safe)
    await supabase
      .from('tenant_site_config')
      .update({
        ai_enhancement_completed_at: enhancedNow,
        ai_enhancement_status:       'completed',
        updated_at:                  enhancedNow,
      })
      .eq('tenant_id', tenantId)
      .then(({ error: _e }: { error: unknown }) => {
        if (_e) { /* column not yet migrated — skip */ }
      })
  } catch {
    // Record failure (schema-gap safe)
    await supabase
      .from('tenant_site_config')
      .update({
        ai_enhancement_status: 'failed',
        updated_at:            new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .then(({ error: _e }: { error: unknown }) => {
        if (_e) { /* column not yet migrated — skip */ }
      })
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates and persists a single fully-populated site variant for the given
 * tenant using their chosen template.
 *
 * Tier 1 (deterministic) runs synchronously and resolves before returning.
 * Tier 2 (Gemini AI enhancement) is dispatched as a fire-and-forget promise
 * and runs in the background without blocking the caller.
 *
 * Returns an {@link InitialSiteBuildResult} describing what happened.
 */
export async function generateInitialSiteFromTemplate(
  tenantId: string,
  tenant:   WaasTenant,
): Promise<InitialSiteBuildResult> {
  let templateSlug = 'modern'

  try {
    // ── Resolve template ────────────────────────────────────────────────────
    const template = await resolveTemplate(tenantId, tenant)
    templateSlug   = template.slug

    // ── Tier 1: deterministic build ─────────────────────────────────────────
    const tier1 = buildTier1Variant(tenant, template)
    await persistTier1Variant(tenantId, tier1)

    // ── Tier 2: Gemini enhancement (fire-and-forget) ─────────────────────────
    const profile = buildProfile(tenant)
    void runGeminiEnhancement(tenantId, tier1, profile, template)

    return {
      tier1Success:    true,
      tier2Dispatched: Boolean(process.env.GEMINI_API_KEY),
      templateSlug,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return {
      tier1Success:    false,
      tier2Dispatched: false,
      templateSlug,
      message,
    }
  }
}
