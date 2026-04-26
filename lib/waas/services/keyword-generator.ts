import { extractDomain, generateKeywords } from './serper'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_LOCATION = 'Chicago, IL'
const SITE_FETCH_TIMEOUT_MS = 12000
const MAX_SITE_TEXT_CHARS = 12000

export interface KeywordGenerationResult {
  keywords: string[]
  detectedIndustry: string | null
  detectedLocation: string | null
  detectedAddress: string | null
  provider: 'gemini' | 'perplexity' | 'fallback'
  confidenceScore: number
  confidenceLabel: 'high' | 'medium' | 'low'
  confidenceReasons: string[]
}

interface SiteSignals {
  domain: string
  homepageUrl: string
  pageUrls: string[]
  fetchedPages: number
  textSnippet: string
  titleHints: string[]
  addressHint: string | null
  locationHint: string | null
}

interface AiKeywordPlan {
  industry: string | null
  location: string | null
  address: string | null
  keywords: string[]
}

function normalizeKeyword(value: string): string {
  return value
    .trim()
    .replace(/^[-*\d.\s]+/, '')
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
}

function dedupeAndLimit(list: string[], max: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  for (const raw of list) {
    const keyword = normalizeKeyword(raw)
    if (!keyword) continue

    const key = keyword.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(keyword)

    if (out.length >= max) break
  }

  return out
}

function normalizeTargetUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return raw

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    return parsed.toString()
  } catch {
    return value
  }
}

function cleanText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .trim()
}

function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')

  return cleanText(withoutScripts.replace(/<[^>]+>/g, ' '))
}

function extractTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!match?.[1]) return null
  return cleanText(match[1])
}

function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
  if (!match?.[1]) return null
  return cleanText(match[1])
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()

  let base: URL
  try {
    base = new URL(baseUrl)
  } catch {
    return out
  }

  const linkRe = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>/gi
  let match: RegExpExecArray | null

  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1]
    try {
      const resolved = new URL(href, base)
      if (resolved.hostname !== base.hostname) continue

      const normalized = resolved.toString().replace(/\/$/, '')
      if (seen.has(normalized)) continue
      seen.add(normalized)
      out.push(normalized)
    } catch {
      // Ignore malformed URLs in markup.
    }
  }

  return out
}

function extractAddressHint(text: string): string | null {
  const addressMatch = text.match(
    /\b\d{1,6}\s+[A-Za-z0-9.#'\-\s]{2,80},\s*[A-Za-z .'\-]{2,60},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/
  )
  return addressMatch ? cleanText(addressMatch[0]) : null
}

function extractLocationHint(text: string): string | null {
  const fromServing = text.match(
    /(?:serving|service area|located in|proudly serving)\s+([A-Za-z .'\-]{2,40},\s*[A-Z]{2})/i
  )
  if (fromServing?.[1]) return cleanText(fromServing[1])

  const cityState = text.match(/\b([A-Za-z .'\-]{2,40},\s*[A-Z]{2})\b/)
  if (cityState?.[1]) return cleanText(cityState[1])

  return null
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'follow',
      signal: AbortSignal.timeout(SITE_FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RankedCEOAuditBot/1.0; +https://rankedceo.com)',
      },
    })

    if (!response.ok) return null

    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return null

    return await response.text()
  } catch {
    return null
  }
}

async function collectSiteSignals(targetUrl: string): Promise<SiteSignals> {
  const homepageUrl = normalizeTargetUrl(targetUrl)
  const domain = extractDomain(targetUrl)

  const fallback: SiteSignals = {
    domain,
    homepageUrl,
    pageUrls: [homepageUrl],
    fetchedPages: 0,
    textSnippet: '',
    titleHints: [],
    addressHint: null,
    locationHint: null,
  }

  const homepageHtml = await fetchHtml(homepageUrl)
  if (!homepageHtml) return fallback

  const homepageText = stripHtml(homepageHtml)
  const title = extractTagContent(homepageHtml, 'title')
  const metaDescription = extractMetaDescription(homepageHtml)
  const links = extractInternalLinks(homepageHtml, homepageUrl)

  const usefulPaths = links.filter(link => {
    const pathname = (() => {
      try {
        return new URL(link).pathname.toLowerCase()
      } catch {
        return ''
      }
    })()

    return /(about|contact|service|services|location|areas|company)/.test(pathname)
  }).slice(0, 2)

  const extraPages = await Promise.all(usefulPaths.map(async (url) => {
    const html = await fetchHtml(url)
    if (!html) return null

    return {
      url,
      text: stripHtml(html),
      title: extractTagContent(html, 'title'),
      description: extractMetaDescription(html),
    }
  }))

  const fetchedPages = 1 + extraPages.filter(page => page !== null).length

  const mergedText = cleanText([
    title ?? '',
    metaDescription ?? '',
    homepageText,
    ...extraPages.flatMap(page => page ? [page.title ?? '', page.description ?? '', page.text] : []),
  ].join(' ')).slice(0, MAX_SITE_TEXT_CHARS)

  const addressHint = extractAddressHint(mergedText)
  const locationHint = addressHint
    ? (addressHint.match(/,\s*([A-Za-z .'\-]{2,40},\s*[A-Z]{2})\s*\d{5}(?:-\d{4})?\b/)?.[1] ?? null)
    : extractLocationHint(mergedText)

  return {
    domain,
    homepageUrl,
    pageUrls: [homepageUrl, ...usefulPaths],
    fetchedPages,
    textSnippet: mergedText,
    titleHints: [title, metaDescription, ...extraPages.map(page => page?.title ?? null)].filter((value): value is string => Boolean(value)),
    addressHint,
    locationHint,
  }
}

function computeConfidence(
  signals: SiteSignals,
  provider: 'gemini' | 'perplexity' | 'fallback'
): {
  score: number
  label: 'high' | 'medium' | 'low'
  reasons: string[]
} {
  let score = 0
  const reasons: string[] = []

  if (signals.fetchedPages >= 1) {
    score += 20
    reasons.push('Website content fetched successfully')
  }

  if (signals.fetchedPages >= 2) {
    score += 12
    reasons.push('Multiple internal pages analyzed')
  }

  if (signals.textSnippet.length >= 600) {
    score += 18
    reasons.push('Sufficient on-site text evidence collected')
  } else if (signals.textSnippet.length >= 200) {
    score += 8
    reasons.push('Limited on-site text evidence collected')
  }

  if (signals.titleHints.length > 0) {
    score += 10
    reasons.push('Title/meta business hints detected')
  }

  if (signals.locationHint) {
    score += 18
    reasons.push('Location signal found on site')
  }

  if (signals.addressHint) {
    score += 22
    reasons.push('Street address signal found on site')
  }

  if (provider === 'gemini') {
    score += 10
    reasons.push('Gemini generated structured keyword plan')
  } else if (provider === 'perplexity') {
    score += 8
    reasons.push('Perplexity generated structured keyword plan')
  } else {
    reasons.push('Fallback keyword strategy used')
  }

  const bounded = Math.max(10, Math.min(99, score))
  const label: 'high' | 'medium' | 'low' = bounded >= 75
    ? 'high'
    : bounded >= 50
      ? 'medium'
      : 'low'

  return {
    score: bounded,
    label,
    reasons,
  }
}

function fallbackKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  max: number
): string[] {
  const seed = generateKeywords(targetUrl, industry, location)
  const city = (location ?? DEFAULT_LOCATION).split(',')[0]?.trim() || 'local'

  const extras = [
    `${industry ?? 'local business'} near me ${city}`,
    `${industry ?? 'service'} ${city} reviews`,
    `${industry ?? 'service'} ${city}`,
  ]

  return dedupeAndLimit([...seed, ...extras], max)
}

function parseGeminiKeywords(text: string): string[] {
  const cleaned = text.trim().replace(/```json\n?|\n?```/g, '')

  try {
    const parsed = JSON.parse(cleaned)

    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string')
    }

    if (parsed && Array.isArray(parsed.keywords)) {
      return parsed.keywords.filter((v: unknown): v is string => typeof v === 'string')
    }
  } catch {
    return []
  }

  return []
}

function parseAiKeywordPlan(text: string): AiKeywordPlan | null {
  const cleaned = text.trim().replace(/```json\n?|\n?```/g, '')

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>
    if (!parsed || typeof parsed !== 'object') return null

    const keywordsRaw = Array.isArray(parsed.keywords) ? parsed.keywords : []
    const keywords = keywordsRaw.filter((value): value is string => typeof value === 'string')

    return {
      industry: typeof parsed.industry === 'string' && parsed.industry.trim().length > 0
        ? parsed.industry.trim()
        : null,
      location: typeof parsed.location === 'string' && parsed.location.trim().length > 0
        ? parsed.location.trim()
        : null,
      address: typeof parsed.address === 'string' && parsed.address.trim().length > 0
        ? parsed.address.trim()
        : null,
      keywords,
    }
  } catch {
    return null
  }
}

async function generateWithGemini(
  signals: SiteSignals,
  industry: string | null,
  location: string | null,
  maxKeywords: number
): Promise<AiKeywordPlan | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null

  const prompt = [
    'Analyze this business website context and produce realistic local SEO keywords.',
    'Use website evidence first (title, services, address/location clues).',
    'Return ONLY valid JSON with this exact shape:',
    '{"industry":"string|null","location":"City, ST or null","address":"full address or null","keywords":["... exactly 5 strings ..."]}',
    'Keyword rules:',
    '- high-intent service keywords that a real buyer would search',
    '- include geographic intent tied to detected city/market',
    '- avoid generic filler and avoid the business name unless clearly transactional',
    '- each keyword must be 2-7 words',
    '',
    `Domain: ${signals.domain}`,
    `Homepage: ${signals.homepageUrl}`,
    `Provided industry hint: ${industry ?? 'none'}`,
    `Provided location hint: ${location ?? 'none'}`,
    `Detected address hint: ${signals.addressHint ?? 'none'}`,
    `Detected location hint: ${signals.locationHint ?? 'none'}`,
    `Title/meta hints: ${signals.titleHints.join(' | ') || 'none'}`,
    `Website text excerpt: ${signals.textSnippet || 'none'}`,
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
            temperature: 0.2,
            maxOutputTokens: 700,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) return null

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || text.trim().length === 0) return null

    const parsed = parseAiKeywordPlan(text)
    if (!parsed) return null

    return {
      ...parsed,
      keywords: dedupeAndLimit(parsed.keywords, maxKeywords),
    }
  } catch {
    return null
  }
}

async function generateWithPerplexity(
  signals: SiteSignals,
  industry: string | null,
  location: string | null,
  maxKeywords: number
): Promise<AiKeywordPlan | null> {
  const apiKey = process.env.PERPLEXITY_API_KEY
  if (!apiKey) return null

  const prompt = [
    'Use the provided website content to infer business type and local market.',
    'Return JSON only with keys industry, location, address, keywords.',
    'keywords must contain exactly 5 realistic local SEO queries.',
    '',
    `Domain: ${signals.domain}`,
    `Provided industry hint: ${industry ?? 'none'}`,
    `Provided location hint: ${location ?? 'none'}`,
    `Detected address hint: ${signals.addressHint ?? 'none'}`,
    `Detected location hint: ${signals.locationHint ?? 'none'}`,
    `Site excerpt: ${signals.textSnippet || 'none'}`,
  ].join('\n')

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content: 'You are a local SEO strategist. Output strict JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    })

    if (!response.ok) return null

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || text.trim().length === 0) return null

    const parsed = parseAiKeywordPlan(text)
    if (!parsed) return null

    return {
      ...parsed,
      keywords: dedupeAndLimit(parsed.keywords, maxKeywords),
    }
  } catch {
    return null
  }
}

// Test hook for parser behavior; keeps runtime code path unchanged.
export function parseGeminiKeywordsForTest(text: string): string[] {
  return parseGeminiKeywords(text)
}

// Test hook for AI plan JSON parser.
export function parseAiKeywordPlanForTest(text: string): AiKeywordPlan | null {
  return parseAiKeywordPlan(text)
}

export async function generateIndustryKeywordPlan(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  maxKeywords: number = 5
): Promise<KeywordGenerationResult> {
  const normalizedUrl = normalizeTargetUrl(targetUrl)
  const siteSignals = await collectSiteSignals(normalizedUrl)

  const fallbackLocation = location ?? siteSignals.locationHint ?? DEFAULT_LOCATION
  const fallbackIndustry = industry ?? null
  const fallback = fallbackKeywords(normalizedUrl, fallbackIndustry, fallbackLocation, maxKeywords)

  const geminiPlan = await generateWithGemini(siteSignals, industry, location, maxKeywords)
  if (geminiPlan && geminiPlan.keywords.length > 0) {
    const confidence = computeConfidence(siteSignals, 'gemini')
    return {
      keywords: geminiPlan.keywords.length < maxKeywords
        ? dedupeAndLimit([...geminiPlan.keywords, ...fallback], maxKeywords)
        : geminiPlan.keywords,
      detectedIndustry: geminiPlan.industry ?? fallbackIndustry,
      detectedLocation: geminiPlan.location ?? siteSignals.locationHint ?? location,
      detectedAddress: geminiPlan.address ?? siteSignals.addressHint,
      provider: 'gemini',
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      confidenceReasons: confidence.reasons,
    }
  }

  const perplexityPlan = await generateWithPerplexity(siteSignals, industry, location, maxKeywords)
  if (perplexityPlan && perplexityPlan.keywords.length > 0) {
    const confidence = computeConfidence(siteSignals, 'perplexity')
    return {
      keywords: perplexityPlan.keywords.length < maxKeywords
        ? dedupeAndLimit([...perplexityPlan.keywords, ...fallback], maxKeywords)
        : perplexityPlan.keywords,
      detectedIndustry: perplexityPlan.industry ?? fallbackIndustry,
      detectedLocation: perplexityPlan.location ?? siteSignals.locationHint ?? location,
      detectedAddress: perplexityPlan.address ?? siteSignals.addressHint,
      provider: 'perplexity',
      confidenceScore: confidence.score,
      confidenceLabel: confidence.label,
      confidenceReasons: confidence.reasons,
    }
  }

  const confidence = computeConfidence(siteSignals, 'fallback')
  return {
    keywords: fallback,
    detectedIndustry: fallbackIndustry,
    detectedLocation: siteSignals.locationHint ?? location,
    detectedAddress: siteSignals.addressHint,
    provider: 'fallback',
    confidenceScore: confidence.score,
    confidenceLabel: confidence.label,
    confidenceReasons: confidence.reasons,
  }
}

export async function generateTopIndustryKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  maxKeywords: number = 5
): Promise<string[]> {
  const result = await generateIndustryKeywordPlan(targetUrl, industry, location, maxKeywords)
  return result.keywords
}
