// lib/waas/services/audit-engine/site-nap.ts
//
// A3: read the business name, phone and address a website publishes about
// itself, so it can be compared with the Google Business Profile ("NAP
// consistency"). Pure and best-effort: anything it cannot read is null.

export interface SiteNap {
  name: string | null;
  /** Display form as printed on the site, e.g. "(512) 555-0142". */
  phone: string | null;
  address: string | null;
  /** Where the phone came from; JSON-LD is the most reliable. */
  source: "json-ld" | "tel-link" | "text" | null;
}

export const EMPTY_SITE_NAP: SiteNap = {
  name: null,
  phone: null,
  address: null,
  source: null,
};

/** Digits only, last 10 for North-American numbers; null if too short to compare. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length < 7 || digits.length > 15) return null;
  return digits.length > 10 ? digits.slice(-10) : digits;
}

const LOCAL_BUSINESS_TYPES =
  /(LocalBusiness|Plumber|Electrician|HVACBusiness|HomeAndConstructionBusiness|GeneralContractor|RoofingContractor|Locksmith|MovingCompany|HousePainter|Dentist|MedicalBusiness|Store|Restaurant|AutoRepair|ProfessionalService|LegalService|RealEstateAgent|HealthAndBeautyBusiness)$/i;

function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function formatAddress(node: unknown): string | null {
  if (typeof node === "string") return cleanText(node) || null;
  if (node && typeof node === "object") {
    const a = node as Record<string, unknown>;
    const parts = [
      a.streetAddress,
      a.addressLocality,
      a.addressRegion,
      a.postalCode,
    ]
      .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      .map(cleanText);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

function typesOf(node: Record<string, unknown>): string[] {
  const t = node["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function findLocalBusinessNode(node: unknown): Record<string, unknown> | null {
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = findLocalBusinessNode(item);
      if (hit) return hit;
    }
    return null;
  }
  if (node && typeof node === "object") {
    const record = node as Record<string, unknown>;
    if (typesOf(record).some((t) => LOCAL_BUSINESS_TYPES.test(t))) return record;
    for (const value of Object.values(record)) {
      const hit = findLocalBusinessNode(value);
      if (hit) return hit;
    }
  }
  return null;
}

function jsonLdBlocks(html: string): unknown[] {
  const out: unknown[] = [];
  const re =
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // invalid JSON-LD is ignored
    }
  }
  return out;
}

const TEL_LINK = /href=["']tel:([^"']+)["']/gi;
// North-American style numbers printed in text: (512) 555-0142, 512-555-0142, 512.555.0142
const TEXT_PHONE = /(?<![\d])(?:\+?1[\s.-]?)?\(?([2-9]\d{2})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})(?![\d])/;

function stripTags(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

/** Pull NAP from one page of HTML. Prefers JSON-LD, then tel: links, then text. */
export function extractNap(html: string | null | undefined): SiteNap {
  if (!html) return { ...EMPTY_SITE_NAP };

  let name: string | null = null;
  let phone: string | null = null;
  let address: string | null = null;
  let source: SiteNap["source"] = null;

  for (const block of jsonLdBlocks(html)) {
    const node = findLocalBusinessNode(block);
    if (!node) continue;
    if (typeof node.name === "string" && node.name.trim()) {
      name = cleanText(node.name);
    }
    if (typeof node.telephone === "string" && normalizePhone(node.telephone)) {
      phone = cleanText(node.telephone);
      source = "json-ld";
    }
    address = formatAddress(node.address);
    break;
  }

  if (!phone) {
    let tel: RegExpExecArray | null;
    TEL_LINK.lastIndex = 0;
    while ((tel = TEL_LINK.exec(html)) !== null) {
      // A malformed percent escape in site markup must not abort the audit:
      // skip that link and keep scanning.
      let candidate: string;
      try {
        candidate = decodeURIComponent(tel[1]).trim();
      } catch {
        continue;
      }
      if (normalizePhone(candidate)) {
        phone = candidate;
        source = "tel-link";
        break;
      }
    }
  }

  if (!phone) {
    const text = stripTags(html).slice(0, 40000);
    const m = TEXT_PHONE.exec(text);
    if (m) {
      phone = `(${m[1]}) ${m[2]}-${m[3]}`;
      source = "text";
    }
  }

  if (!name) {
    const og = html.match(
      /<meta\b[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i,
    );
    if (og?.[1]) name = cleanText(og[1]);
  }

  return { name, phone, address, source };
}
