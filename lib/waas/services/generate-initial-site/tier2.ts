import type { GeneratedSiteVariant } from '@/lib/waas/types'
import type { SectionConfig, SectionId, SiteTemplate, SeoStrategy } from '@/lib/waas/templates/types'
import { getAdminClient, normalizeOrder, GEMINI_API_BASE, GEMINI_MODEL } from './_shared'
import type { GenerationProfile } from './types'

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

export async function runGeminiEnhancement(
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
