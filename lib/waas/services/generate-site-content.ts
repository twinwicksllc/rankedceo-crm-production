import type { WaasTenant } from '@/lib/waas/types'
import { getTemplate } from '@/lib/waas/templates/registry'
import type {
  AboutSectionContent,
  FAQSectionContent,
  HowItWorksSectionContent,
  SectionConfig,
  SectionId,
} from '@/lib/waas/templates/types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-pro'

export interface GeneratedSiteVariant {
  variantIndex: number
  variantLabel: string
  variantRationale: string
  templateSlug: string
  sections: SectionConfig[]
}

interface GenerationProfile {
  businessName: string
  trade: string
  industry: string
  location: string
  usp: string
  tagline: string
  primaryCta: string
  aboutNarrative: string
  valuePropositions: string[]
  keyPhrases: string[]
  targetAudience: string
  tone: string
  serviceArea: string
  services: string[]
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function extractList(value: unknown): string[] {
  if (typeof value !== 'string') return []
  return value
    .split(/[\n,;|]/)
    .map(item => item.trim())
    .filter(Boolean)
}

function cloneSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.map((section) => ({
    ...section,
    config: { ...section.config },
    content: section.content ? { ...section.content } : undefined,
  }))
}

function upsertSection(
  sections: SectionConfig[],
  section: SectionId,
  patch: Partial<SectionConfig>,
): SectionConfig[] {
  const index = sections.findIndex(item => item.section === section)
  if (index >= 0) {
    const existing = sections[index]
    const next: SectionConfig = {
      ...existing,
      ...patch,
      config: {
        ...existing.config,
        ...(patch.config ?? {}),
      },
    }
    sections[index] = next
    return sections
  }

  const nextOrder = Math.max(0, ...sections.map(item => item.order)) + 1
  sections.push({
    section,
    enabled: patch.enabled ?? true,
    order: patch.order ?? nextOrder,
    config: patch.config ?? {},
    content: patch.content,
  })
  return sections
}

function normalizeOrder(sections: SectionConfig[]): SectionConfig[] {
  return [...sections]
    .sort((a, b) => a.order - b.order)
    .map((section, index) => ({ ...section, order: index + 1 }))
}

function buildProfile(tenant: WaasTenant): GenerationProfile {
  const brand = asRecord(tenant.brand_config)
  const content = asRecord(brand.content)
  const seo = asRecord(brand.seo)
  const intake = asRecord(brand.intake_profile)

  const businessName = typeof brand.business_name === 'string' && brand.business_name.trim()
    ? brand.business_name.trim()
    : tenant.legal_name ?? 'Your Business'

  const trade = tenant.primary_trade ?? tenant.target_industry ?? 'Local service'

  return {
    businessName,
    trade,
    industry: tenant.target_industry ?? trade,
    location: tenant.target_location ?? ([tenant.city, tenant.state].filter(Boolean).join(', ') || 'your local area'),
    usp: typeof tenant.usp === 'string' && tenant.usp.trim()
      ? tenant.usp.trim()
      : typeof content.usp === 'string' && content.usp.trim()
        ? content.usp.trim()
        : 'Trusted local service with fast response',
    tagline: typeof brand.tagline === 'string' && brand.tagline.trim() ? brand.tagline.trim() : '',
    primaryCta: typeof content.primary_cta === 'string' && content.primary_cta.trim()
      ? content.primary_cta.trim()
      : 'Book a Free Estimate',
    aboutNarrative: typeof content.about_narrative === 'string' && content.about_narrative.trim()
      ? content.about_narrative.trim()
      : `${businessName} helps customers in ${tenant.target_location ?? 'the local area'} with reliable ${trade.toLowerCase()} services.`,
    valuePropositions: extractList(content.value_propositions),
    keyPhrases: extractList(seo.key_phrases),
    targetAudience: typeof intake.target_audience === 'string' ? intake.target_audience : 'Homeowners and local businesses',
    tone: typeof brand.tone === 'string' && brand.tone.trim() ? brand.tone.trim() : 'Professional',
    serviceArea: typeof seo.service_area === 'string' && seo.service_area.trim() ? seo.service_area.trim() : (tenant.target_location ?? 'Local area'),
    services: extractList(intake.services_offered),
  }
}

function buildFaqContent(profile: GenerationProfile): FAQSectionContent {
  const propositions = profile.valuePropositions.slice(0, 3)
  const items = [
    {
      question: `Do you offer ${profile.trade.toLowerCase()} service across ${profile.serviceArea}?`,
      answer: `Yes. We provide coverage across ${profile.serviceArea} and surrounding areas depending on project scope.`,
    },
    {
      question: 'How soon can we get started?',
      answer: 'We confirm availability quickly and align scheduling based on urgency and location.',
    },
    {
      question: 'How do pricing and estimates work?',
      answer: 'You receive clear scope and pricing details before work begins.',
    },
  ]

  if (propositions.length > 0) {
    items.push({
      question: 'Why choose your team over competitors?',
      answer: propositions.join(' • '),
    })
  }

  return {
    eyebrow: 'FAQ',
    headline: 'Common Questions',
    intro: `Quick answers about our ${profile.trade.toLowerCase()} process.`,
    items,
  }
}

function buildProcessContent(profile: GenerationProfile): HowItWorksSectionContent {
  return {
    eyebrow: 'How It Works',
    headline: `A Clear ${profile.trade} Process`,
    intro: 'Simple steps from first contact to final quality check.',
    steps: [
      { title: 'Reach Out', description: `Tell us about your project and goals in ${profile.location}.` },
      { title: 'Plan & Quote', description: 'We review options, timelines, and transparent pricing.' },
      { title: 'Deliver', description: 'Our team completes the work and confirms everything meets expectations.' },
    ],
  }
}

function buildDeterministicVariants(profile: GenerationProfile): GeneratedSiteVariant[] {
  const services = profile.services.length > 0
    ? profile.services.slice(0, 6).map((service) => ({ title: service, description: `${service} handled by trained professionals.` }))
    : undefined

  const aboutContent: AboutSectionContent = {
    eyebrow: 'Our Story',
    headline: `Why ${profile.businessName} Exists`,
    body: profile.aboutNarrative,
    highlights: profile.valuePropositions.slice(0, 4),
  }

  const commonPatches: Array<Partial<GeneratedSiteVariant> & { templateSlug: string; variantIndex: number; variantLabel: string; variantRationale: string }> = [
    {
      variantIndex: 1,
      variantLabel: 'Conversion-First',
      variantRationale: 'Leads with USP and direct calls-to-action for high-intent visitors.',
      templateSlug: 'bold',
    },
    {
      variantIndex: 2,
      variantLabel: 'Brand Story',
      variantRationale: 'Highlights credibility and narrative to build trust quickly.',
      templateSlug: 'trust-first',
    },
    {
      variantIndex: 3,
      variantLabel: 'Authority Process',
      variantRationale: 'Focuses on expertise, process clarity, and FAQ confidence builders.',
      templateSlug: 'modern',
    },
  ]

  return commonPatches.map((base) => {
    let sections = cloneSections(getTemplate(base.templateSlug).default_layout_json)

    sections = upsertSection(sections, 'hero', {
      enabled: true,
      content: {
        eyebrow: profile.tone,
        headline: profile.usp,
        subheadline: `Serving ${profile.location}. ${profile.tagline || `${profile.businessName} delivers reliable results.`}`,
        primaryCtaLabel: profile.primaryCta,
      },
    })

    sections = upsertSection(sections, 'services', {
      enabled: true,
      content: {
        eyebrow: 'Services',
        headline: `${profile.trade} Services`,
        subheadline: `Built for ${profile.targetAudience}.`,
        items: services,
      },
    })

    sections = upsertSection(sections, 'booking', {
      enabled: true,
      content: {
        eyebrow: 'Get Started',
        headline: 'Schedule Your Consultation',
        subheadline: 'Pick a convenient time and we will handle the rest.',
        primaryCtaLabel: profile.primaryCta,
      },
    })

    sections = upsertSection(sections, 'about', {
      enabled: true,
      content: aboutContent,
    })

    sections = upsertSection(sections, 'faq', {
      enabled: base.variantIndex !== 1,
      content: buildFaqContent(profile),
    })

    sections = upsertSection(sections, 'how-it-works', {
      enabled: base.variantIndex !== 2,
      content: buildProcessContent(profile),
    })

    sections = upsertSection(sections, 'trust', {
      enabled: true,
      content: {
        headline: `Trusted by clients across ${profile.location}`,
        subheadline: profile.valuePropositions[0],
      },
    })

    sections = upsertSection(sections, 'reviews', {
      enabled: true,
      content: {
        headline: 'Proof From Real Customers',
        subheadline: `${profile.businessName} is built on repeat business and referrals.`,
      },
    })

    return {
      variantIndex: base.variantIndex,
      variantLabel: base.variantLabel,
      variantRationale: base.variantRationale,
      templateSlug: base.templateSlug,
      sections: normalizeOrder(sections),
    }
  })
}

function parseJsonResponse(text: string): unknown {
  const cleaned = text.trim().replace(/```json\n?|\n?```/g, '')
  return JSON.parse(cleaned)
}

function sanitizeSections(value: unknown): SectionConfig[] {
  if (!Array.isArray(value)) return []

  const allowed: SectionId[] = ['hero', 'services', 'trust', 'financing', 'booking', 'reviews', 'about', 'faq', 'how-it-works']

  return value
    .filter((row) => row && typeof row === 'object')
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.section === 'string' && allowed.includes(row.section as SectionId))
    .map((row, index) => ({
      section: row.section as SectionId,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
      order: typeof row.order === 'number' ? row.order : (index + 1),
      config: row.config && typeof row.config === 'object' ? (row.config as Record<string, unknown>) : {},
      content: row.content && typeof row.content === 'object' ? (row.content as Record<string, unknown>) : undefined,
    }))
}

function sanitizeVariants(raw: unknown, profile: GenerationProfile): GeneratedSiteVariant[] {
  if (!Array.isArray(raw)) return []

  const out: GeneratedSiteVariant[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>

    const variantIndex = typeof row.variantIndex === 'number' ? row.variantIndex : out.length + 1
    const templateSlug = typeof row.templateSlug === 'string' && row.templateSlug.trim() ? row.templateSlug.trim() : 'modern'
    const sections = sanitizeSections(row.sections)
    if (sections.length === 0) continue

    out.push({
      variantIndex,
      variantLabel: typeof row.variantLabel === 'string' && row.variantLabel.trim() ? row.variantLabel.trim() : `Variant ${variantIndex}`,
      variantRationale: typeof row.variantRationale === 'string' && row.variantRationale.trim()
        ? row.variantRationale.trim()
        : `Tailored for ${profile.businessName}.`,
      templateSlug,
      sections: normalizeOrder(sections),
    })
  }

  return out.slice(0, 3)
}

async function generateWithGemini(profile: GenerationProfile, notes?: string): Promise<GeneratedSiteVariant[] | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt = [
    'Generate exactly 3 website variants for a local business based on onboarding data.',
    'Return ONLY valid JSON as an array of 3 items.',
    'Each item must include: variantIndex, variantLabel, variantRationale, templateSlug, sections.',
    'Each sections item must include: section, enabled, order, config, content.',
    'Allowed section values: hero, services, trust, financing, booking, reviews, about, faq, how-it-works.',
    'Allowed templateSlug values: modern, bold, trust-first.',
    'Use onboarding inputs as source of truth; do not invent factual claims or certifications.',
    'Use the business USP, tagline, CTA, and about narrative as core source text.',
    '',
    'Variant strategy goals:',
    '1) Conversion-First: strong CTA, direct messaging, service-led structure.',
    '2) Brand Story: trust-first narrative, social proof emphasis, warmer voice.',
    '3) Authority Process: professional voice, process clarity, FAQ confidence.',
    '',
    `Business name: ${profile.businessName}`,
    `Trade: ${profile.trade}`,
    `Industry: ${profile.industry}`,
    `Location: ${profile.location}`,
    `Service area: ${profile.serviceArea}`,
    `Target audience: ${profile.targetAudience}`,
    `USP: ${profile.usp}`,
    `Tagline: ${profile.tagline || 'none provided'}`,
    `Primary CTA: ${profile.primaryCta}`,
    `About narrative: ${profile.aboutNarrative}`,
    `Value propositions: ${profile.valuePropositions.join(' | ') || 'none provided'}`,
    `Key phrases: ${profile.keyPhrases.join(' | ') || 'none provided'}`,
    `Tone preference: ${profile.tone}`,
    `Services offered: ${profile.services.join(' | ') || 'none provided'}`,
    notes ? `Admin notes: ${notes}` : '',
  ].filter(Boolean).join('\n')

  try {
    const response = await fetch(`${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) return null

    const parsed = parseJsonResponse(text)
    const sanitized = sanitizeVariants(parsed, profile)
    return sanitized.length === 3 ? sanitized : null
  } catch {
    return null
  }
}

export async function generateSiteVariants(tenant: WaasTenant, notes?: string): Promise<GeneratedSiteVariant[]> {
  const profile = buildProfile(tenant)
  const aiVariants = await generateWithGemini(profile, notes)
  if (aiVariants && aiVariants.length === 3) {
    return aiVariants
  }

  return buildDeterministicVariants(profile)
}
