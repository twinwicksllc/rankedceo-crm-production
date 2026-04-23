import type { SiteTemplate, SectionConfig } from '@/lib/waas/templates/types'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'

export interface TemplateRecommendation {
  templateSlug: string
  label: string
  rationale: string
  confidence: number
  highlights: string[]
}

interface TenantProfile {
  businessName: string
  industry: string | null
  location: string | null
  usp: string | null
  financingEnabled: boolean
  hasBooking: boolean
  tone: string | null
}

function buildHighlights(sections: SectionConfig[]): string[] {
  return sections
    .filter(section => section.enabled)
    .slice(0, 4)
    .map(section => section.section)
}

function fallbackRecommendations(
  tenant: TenantProfile,
  templates: SiteTemplate[]
): TemplateRecommendation[] {
  const scoreTemplate = (slug: string): number => {
    const industry = (tenant.industry ?? '').toLowerCase()
    if (slug === 'trust-first') {
      let score = 72
      if (/dental|medical|legal|real/.test(industry)) score += 15
      if ((tenant.usp ?? '').length > 40) score += 5
      return score
    }
    if (slug === 'bold') {
      let score = 70
      if (/hvac|plumbing|roof|electrical|contractor/.test(industry)) score += 15
      if (tenant.financingEnabled) score += 5
      return score
    }

    let score = 68
    if (tenant.hasBooking) score += 8
    if ((tenant.tone ?? '').toLowerCase().includes('professional')) score += 4
    return score
  }

  return templates
    .map((template) => {
      const highlights = buildHighlights(template.default_layout_json)
      return {
        templateSlug: template.slug,
        label: template.name,
        rationale: `${template.name} aligns with ${tenant.industry ?? 'service'} positioning and prioritizes ${highlights.join(', ')} sections.`,
        confidence: Math.min(96, scoreTemplate(template.slug)),
        highlights,
      }
    })
    .sort((a, b) => b.confidence - a.confidence)
}

function sanitizeRecommendations(
  raw: unknown,
  templates: SiteTemplate[]
): TemplateRecommendation[] {
  if (!Array.isArray(raw)) return []

  const templateBySlug = new Map(templates.map(t => [t.slug, t]))
  const out: TemplateRecommendation[] = []

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const templateSlug = typeof rec.templateSlug === 'string' ? rec.templateSlug : ''
    const template = templateBySlug.get(templateSlug)
    if (!template) continue

    const label = typeof rec.label === 'string' && rec.label.trim()
      ? rec.label.trim()
      : template.name
    const rationale = typeof rec.rationale === 'string' && rec.rationale.trim()
      ? rec.rationale.trim()
      : `${template.name} is a strong fit for this lead profile.`
    const confidenceRaw = typeof rec.confidence === 'number' ? rec.confidence : 75
    const confidence = Math.max(50, Math.min(99, Math.round(confidenceRaw)))
    const highlightsRaw = Array.isArray(rec.highlights) ? rec.highlights : []
    const highlights = highlightsRaw
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .slice(0, 5)

    out.push({
      templateSlug,
      label,
      rationale,
      confidence,
      highlights: highlights.length > 0 ? highlights : buildHighlights(template.default_layout_json),
    })
  }

  return out
}

export async function recommendTemplates(
  tenant: TenantProfile,
  templates: SiteTemplate[]
): Promise<TemplateRecommendation[]> {
  const fallback = fallbackRecommendations(tenant, templates)
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return fallback

  const prompt = [
    'You are selecting website templates for a local business onboarding flow.',
    'Return JSON only as an array of exactly 3 objects with keys:',
    'templateSlug, label, rationale, confidence, highlights.',
    `Allowed templateSlug values: ${templates.map(t => t.slug).join(', ')}`,
    'Confidence must be 50-99.',
    '',
    `Business name: ${tenant.businessName}`,
    `Industry: ${tenant.industry ?? 'unknown'}`,
    `Location: ${tenant.location ?? 'unknown'}`,
    `USP: ${tenant.usp ?? 'none provided'}`,
    `Financing enabled: ${tenant.financingEnabled}`,
    `Has booking URL: ${tenant.hasBooking}`,
    `Tone preference: ${tenant.tone ?? 'not set'}`,
  ].join('\n')

  try {
    const response = await fetch(
      `${GEMINI_API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 700,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) return fallback

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) return fallback

    const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    const cleaned = sanitizeRecommendations(parsed, templates)
    if (cleaned.length === 0) return fallback

    const used = new Set(cleaned.map(item => item.templateSlug))
    const missing = fallback.filter(item => !used.has(item.templateSlug))

    return [...cleaned, ...missing].slice(0, 3)
  } catch {
    return fallback
  }
}
