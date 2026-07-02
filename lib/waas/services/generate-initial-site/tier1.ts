import { getTemplate, ALL_TEMPLATES } from "@/lib/waas/templates/registry";
import { recommendTemplates } from "@/lib/waas/services/template-recommender";
import { getContentPack } from "@/lib/waas/content-packs";
import type { WaasTenant, GeneratedSiteVariant } from "@/lib/waas/types";
import type {
  SiteTemplate,
  AboutSectionContent,
} from "@/lib/waas/templates/types";
import {
  getAdminClient,
  asRecord,
  cloneSections,
  upsertSection,
  normalizeOrder,
} from "./_shared";
import { buildProfile } from "./profile";
import {
  buildFaqContent,
  buildProcessContent,
  getStrategyDirectives,
} from "./section-builders";

// ---------------------------------------------------------------------------
// Tier 1 — Deterministic build
// ---------------------------------------------------------------------------

export function buildTier1Variant(
  tenant: WaasTenant,
  template: SiteTemplate,
): GeneratedSiteVariant {
  const profile = buildProfile(tenant);
  const strategy = template.seo_strategy;
  const directives = getStrategyDirectives(strategy, profile);

  // ── Service items ────────────────────────────────────────────────────────────────────────────
  // Prefer rich pack descriptions when service titles match pack defaults;
  // fall back to generic description for custom tenant-supplied services.
  const pack = getContentPack(profile.trade);
  const packServiceMap = new Map(
    pack.defaultServices.map((s) => [s.title.toLowerCase(), s.description]),
  );

  const services =
    profile.services.length > 0
      ? profile.services.slice(0, 6).map((title) => ({
          title,
          description:
            packServiceMap.get(title.toLowerCase()) ??
            `${title} provided by ${profile.businessName} in ${profile.location}.`,
        }))
      : undefined;

  // ── Hero copy enrichment ────────────────────────────────────────────────────────────────────────
  // Pack provides strategy-keyed hero copy patterns.  We use the pack's
  // eyebrow as a richer location-aware eyebrow when the tenant has no tagline.
  const packHero =
    pack.heroCopyPatterns[strategy as keyof typeof pack.heroCopyPatterns] ??
    pack.heroCopyPatterns["standard"];

  const heroEyebrow =
    directives.heroEyebrow !== `${profile.trade} — ${profile.location}` &&
    directives.heroEyebrow !== `${profile.trade} Experts`
      ? directives.heroEyebrow // strategy directive wins if it's specific
      : packHero
        ? `${packHero.eyebrow} — ${profile.location}`
        : directives.heroEyebrow;

  const aboutContent: AboutSectionContent = {
    eyebrow: "About Us",
    headline: `Why ${profile.businessName}?`,
    body: profile.aboutNarrative,
    highlights: profile.valuePropositions.slice(0, 4),
  };

  let sections = cloneSections(template.default_layout_json);

  // ── Hero ─────────────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "hero", {
    enabled: true,
    content: {
      eyebrow: heroEyebrow,
      headline: profile.usp,
      subheadline: `${directives.heroPreamble}${
        profile.tagline
          ? profile.tagline
          : `Serving ${profile.location} — ${profile.businessName} delivers reliable results.`
      }`,
      primaryCtaLabel: profile.primaryCta,
    },
  });

  // ── Services ────────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "services", {
    enabled: true,
    content: {
      eyebrow: directives.servicesEyebrow,
      headline: profile.tradeDisplayName,
      subheadline: `Built for ${profile.targetAudience} in ${profile.location}.`,
      items: services,
    },
  });

  // ── Trust ───────────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "trust", {
    enabled: true,
    content: {
      headline: directives.trustHeadline,
      subheadline:
        profile.valuePropositions[0] ?? profile.trustSignals[0] ?? undefined,
      items: profile.trustSignals.map((signal) => ({ title: signal })),
    },
  });

  // ── About ──────────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "about", {
    enabled: true,
    content: aboutContent,
  });

  // ── FAQ ──────────────────────────────────────────────────────────────────────────────────────────────
  // Always populate content; let template default determine enabled/disabled
  sections = upsertSection(sections, "faq", {
    content: buildFaqContent(profile, strategy),
  });

  // ── How It Works ─────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "how-it-works", {
    content: buildProcessContent(profile, strategy),
  });

  // ── Reviews ─────────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "reviews", {
    enabled: true,
    content: {
      headline: "What Our Customers Say",
      subheadline: `${profile.businessName} is built on repeat business and referrals.`,
    },
  });

  // ── Booking ────────────────────────────────────────────────────────────────────────────────────────
  sections = upsertSection(sections, "booking", {
    enabled: true,
    content: {
      eyebrow: directives.bookingEyebrow,
      headline: directives.bookingHeadline,
      subheadline: "Pick a time that works for you — we handle the rest.",
      primaryCtaLabel: profile.primaryCta,
    },
  });

  // Build label and rationale from template metadata
  const variantLabel = `${template.name} — ${profile.trade}`;
  const variantRationale = [
    `Generated using the "${template.name}" template (${template.seo_strategy} SEO strategy).`,
    template.mood ? `Aesthetic: ${template.mood}.` : "",
    `Tuned for ${profile.trade} businesses in ${profile.location}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    variantIndex: 0,
    variantLabel,
    variantRationale,
    templateSlug: template.slug,
    sections: normalizeOrder(sections),
  };
}

// ---------------------------------------------------------------------------
// Resolve template — from stored slug, fallback to industry recommendation
// ---------------------------------------------------------------------------

export async function resolveTemplate(
  tenantId: string,
  tenant: WaasTenant,
): Promise<SiteTemplate> {
  // 1. Try to read the client's selection from tenant_site_config
  try {
    const supabase = getAdminClient();
    const { data: configRow } = await supabase
      .from("tenant_site_config")
      .select("client_selected_template_slug")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const storedSlug =
      configRow &&
      typeof (configRow as Record<string, unknown>)
        .client_selected_template_slug === "string"
        ? ((configRow as Record<string, unknown>)
            .client_selected_template_slug as string)
        : null;

    if (storedSlug) {
      try {
        return getTemplate(storedSlug);
      } catch {
        // Unknown slug — fall through to recommendation
      }
    }
  } catch {
    // DB unavailable — fall through
  }

  // 2. Industry recommendation fallback
  const brand = asRecord(tenant.brand_config);
  const recommendations = await recommendTemplates(
    {
      businessName:
        typeof brand.business_name === "string"
          ? brand.business_name
          : "Business",
      industry: tenant.primary_trade ?? tenant.target_industry ?? null,
      location: tenant.target_location ?? null,
      usp: tenant.usp ?? null,
      financingEnabled: Boolean(tenant.financing_enabled),
      hasBooking: Boolean(tenant.calendly_url),
      tone: typeof brand.tone === "string" ? brand.tone : null,
    },
    ALL_TEMPLATES,
  ).catch(() => []);

  if (recommendations.length > 0) {
    try {
      return getTemplate(recommendations[0].templateSlug);
    } catch {
      // Recommendation returned unknown slug
    }
  }

  // 3. Hard fallback — 'modern'
  return getTemplate("modern");
}

// ---------------------------------------------------------------------------
// Persist Tier 1 variant to tenant_site_variants
// ---------------------------------------------------------------------------

export async function persistTier1Variant(
  tenantId: string,
  variant: GeneratedSiteVariant,
): Promise<void> {
  const supabase = getAdminClient();
  const now = new Date().toISOString();

  const { error: upsertError } = await supabase
    .from("tenant_site_variants")
    .upsert(
      {
        tenant_id: tenantId,
        variant_index: variant.variantIndex,
        variant_label: variant.variantLabel,
        variant_rationale: variant.variantRationale,
        template_slug: variant.templateSlug,
        sections_json: variant.sections,
        generation_notes: "tier1_deterministic",
        status: "selected",
        generated_at: now,
        updated_at: now,
      },
      { onConflict: "tenant_id,variant_index" },
    );

  if (upsertError) {
    const msg = upsertError.message ?? "";
    const isSchemaGap =
      /could not find.*table.*tenant_site_variants/i.test(msg) ||
      /relation.*tenant_site_variants.*does not exist/i.test(msg);
    if (!isSchemaGap) {
      throw new Error(upsertError.message);
    }
    // Schema gap — silently skip
    return;
  }

  // Mark initial_build_completed_at in tenant_site_config (schema-gap safe)
  await supabase
    .from("tenant_site_config")
    .upsert(
      {
        tenant_id: tenantId,
        initial_build_completed_at: now,
        updated_at: now,
      },
      { onConflict: "tenant_id" },
    )
    .then(({ error: _configErr }: { error: unknown }) => {
      if (_configErr) {
        // Missing column is fine — migration may not be applied yet
      }
    });
}
