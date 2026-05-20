// lib/waas/services/keyword-generator/text-utils.ts

export function normalizeKeyword(value: string): string {
  return value
    .trim()
    .replace(/^[-*\d.\s]+/, '')
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .replace(/^[_*`~]+|[_*`~]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function dedupeAndLimit(list: string[], max: number): string[] {
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

export function normalizeTargetUrl(raw: string): string {
  const value = raw.trim()
  if (!value) return raw

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`)
    return parsed.toString()
  } catch {
    return value
  }
}

export function cleanText(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/ /g, ' ')
    .trim()
}

export function stripHtml(html: string): string {
  const withoutScripts = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')

  return cleanText(withoutScripts.replace(/<[^>]+>/g, ' '))
}

export function extractTagContent(html: string, tag: string): string | null {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
  if (!match?.[1]) return null
  return cleanText(match[1])
}

export function extractMetaDescription(html: string): string | null {
  const match = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i)
  if (!match?.[1]) return null
  return cleanText(match[1])
}
