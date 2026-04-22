import { extractDomain, generateKeywords } from './serper'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const GEMINI_MODEL = 'gemini-2.5-flash'
const DEFAULT_LOCATION = 'Chicago, IL'

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

function fallbackKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  max: number
): string[] {
  const seed = generateKeywords(targetUrl, industry, location)
  const domain = extractDomain(targetUrl)
  const city = (location ?? DEFAULT_LOCATION).split(',')[0]?.trim() || 'local'

  const extras = [
    `${industry ?? 'local business'} near me ${city}`,
    `${industry ?? 'service'} ${city} reviews`,
    `${domain} ${city}`,
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
    // Fall through to newline parsing.
  }

  return cleaned
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
}

export async function generateTopIndustryKeywords(
  targetUrl: string,
  industry: string | null,
  location: string | null,
  maxKeywords: number = 5
): Promise<string[]> {
  const fallback = fallbackKeywords(targetUrl, industry, location, maxKeywords)
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) return fallback

  const domain = extractDomain(targetUrl)
  const loc = location ?? DEFAULT_LOCATION
  const industryLabel = industry ?? 'local service business'

  const prompt = [
    'Return EXACTLY 5 SEO keywords as a JSON array of strings.',
    'Requirements:',
    '- Focus on high-intent local search terms that can drive leads.',
    '- Include location intent for the business area.',
    '- Do not include the business name unless it is a local-intent query.',
    '- Keep each keyword between 2 and 7 words.',
    '',
    `Business domain: ${domain}`,
    `Industry: ${industryLabel}`,
    `Location: ${loc}`,
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
            temperature: 0.3,
            maxOutputTokens: 256,
            responseMimeType: 'application/json',
          },
        }),
      }
    )

    if (!response.ok) return fallback

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text || typeof text !== 'string') return fallback

    const aiKeywords = dedupeAndLimit(parseGeminiKeywords(text), maxKeywords)
    if (aiKeywords.length === 0) return fallback

    if (aiKeywords.length < maxKeywords) {
      return dedupeAndLimit([...aiKeywords, ...fallback], maxKeywords)
    }

    return aiKeywords
  } catch {
    return fallback
  }
}
