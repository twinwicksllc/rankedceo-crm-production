// =============================================================================
// WaaS Phase 4: Template Registry
// Hardcoded template definitions matching the 008 migration seed data
// =============================================================================

import type { SiteTemplate, SectionConfig } from '@/lib/waas/templates/types'

// ---------------------------------------------------------------------------
// Modern Template — clean, minimal, whitespace-forward
// ---------------------------------------------------------------------------

const modernSections: SectionConfig[] = [
  { section: 'hero',      enabled: true,  order: 1, config: { variant: 'centered', showTextmark: true } },
  { section: 'trust',     enabled: true,  order: 2, config: { variant: 'badge-row' } },
  { section: 'services',  enabled: true,  order: 3, config: { columns: 3, showIcons: true } },
  { section: 'booking',   enabled: true,  order: 4, config: { variant: 'inline' } },
  { section: 'financing', enabled: false, order: 5, config: {} },
  { section: 'reviews',   enabled: true,  order: 6, config: { showNFC: true } },
]

// ---------------------------------------------------------------------------
// Bold Template — high-contrast, aggressive CTAs, dark sections
// ---------------------------------------------------------------------------

const boldSections: SectionConfig[] = [
  { section: 'hero',      enabled: true,  order: 1, config: { variant: 'split', showTextmark: true } },
  { section: 'services',  enabled: true,  order: 2, config: { columns: 2, showIcons: true } },
  { section: 'trust',     enabled: true,  order: 3, config: { variant: 'full-width' } },
  { section: 'financing', enabled: true,  order: 4, config: {} },
  { section: 'booking',   enabled: true,  order: 5, config: { variant: 'modal-trigger' } },
  { section: 'reviews',   enabled: true,  order: 6, config: { showNFC: true } },
]

// ---------------------------------------------------------------------------
// Trust-First Template — social proof heavy, reviews front and center
// ---------------------------------------------------------------------------

const trustFirstSections: SectionConfig[] = [
  { section: 'hero',      enabled: true,  order: 1, config: { variant: 'centered', showTextmark: true } },
  { section: 'reviews',   enabled: true,  order: 2, config: { showNFC: true, variant: 'prominent' } },
  { section: 'trust',     enabled: true,  order: 3, config: { variant: 'badge-row' } },
  { section: 'services',  enabled: true,  order: 4, config: { columns: 3, showIcons: true } },
  { section: 'booking',   enabled: true,  order: 5, config: { variant: 'inline' } },
  { section: 'financing', enabled: false, order: 6, config: {} },
]

// ---------------------------------------------------------------------------
// Template registry map
// ---------------------------------------------------------------------------

export const TEMPLATE_REGISTRY: Record<string, SiteTemplate> = {
  modern: {
    id:                  'modern',
    name:                'Modern',
    slug:                'modern',
    description:         'Clean, minimal design with bold typography and plenty of whitespace. Best for tech-forward trades.',
    preview_image_url:   null,
    default_layout_json: modernSections,
    base_css:            null,
    is_active:           true,
    is_default:          true,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  },
  bold: {
    id:                  'bold',
    name:                'Bold',
    slug:                'bold',
    description:         'High-contrast, aggressive CTAs with dark sections. Best for competitive markets.',
    preview_image_url:   null,
    default_layout_json: boldSections,
    base_css:            null,
    is_active:           true,
    is_default:          false,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  },
  'trust-first': {
    id:                  'trust-first',
    name:                'Trust-First',
    slug:                'trust-first',
    description:         'Social proof-heavy layout leading with reviews and credentials. Best for high-trust trades.',
    preview_image_url:   null,
    default_layout_json: trustFirstSections,
    base_css:            null,
    is_active:           true,
    is_default:          false,
    created_at:          new Date().toISOString(),
    updated_at:          new Date().toISOString(),
  },
}

export const DEFAULT_TEMPLATE = TEMPLATE_REGISTRY['modern']

// ---------------------------------------------------------------------------
// Get template by slug (falls back to modern)
// ---------------------------------------------------------------------------

export function getTemplate(slug: string): SiteTemplate {
  return TEMPLATE_REGISTRY[slug] ?? DEFAULT_TEMPLATE
}

// ---------------------------------------------------------------------------
// Merge tenant active sections with template defaults
// Tenant config overrides template defaults; template fills in missing sections
// ---------------------------------------------------------------------------

export function resolveSections(
  templateSections: SectionConfig[],
  tenantOverrides:  SectionConfig[]
): SectionConfig[] {
  if (!tenantOverrides || tenantOverrides.length === 0) {
    return [...templateSections].sort((a, b) => a.order - b.order)
  }

  // Build a map of tenant overrides by section id
  const overrideMap = new Map(tenantOverrides.map(s => [s.section, s]))

  // Merge: tenant overrides win, template fills missing
  const merged = templateSections.map(templateSection => {
    const override = overrideMap.get(templateSection.section)
    return override
      ? { ...templateSection, ...override, config: { ...templateSection.config, ...override.config } }
      : templateSection
  })

  return merged.sort((a, b) => a.order - b.order)
}

export const ALL_TEMPLATES = Object.values(TEMPLATE_REGISTRY)