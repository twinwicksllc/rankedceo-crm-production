// lib/waas/services/keyword-generator/site-scraper.ts
import { extractDomain } from '../serper'
import { SITE_FETCH_TIMEOUT_MS, MAX_SITE_TEXT_CHARS } from './types'
import type { SiteSignals } from './types'
import { normalizeTargetUrl, cleanText, stripHtml, extractTagContent, extractMetaDescription } from './text-utils'

export function extractInternalLinks(html: string, baseUrl: string): string[] {
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

export function extractAddressHint(text: string): string | null {
  const addressMatch = text.match(
    /\b\d{1,6}\s+[A-Za-z0-9.#'\-\s]{2,80},\s*[A-Za-z .'\-]{2,60},\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?\b/
  )
  return addressMatch ? cleanText(addressMatch[0]) : null
}

export function extractLocationHint(text: string): string | null {
  const fromServing = text.match(
    /(?:serving|service area|located in|proudly serving)\s+([A-Za-z .'\-]{2,40},\s*[A-Z]{2})/i
  )
  if (fromServing?.[1]) return cleanText(fromServing[1])

  const cityState = text.match(/\b([A-Za-z .'\-]{2,40},\s*[A-Z]{2})\b/)
  if (cityState?.[1]) return cleanText(cityState[1])

  return null
}

export async function fetchHtml(url: string): Promise<string | null> {
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

export async function collectSiteSignals(targetUrl: string): Promise<SiteSignals> {
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
