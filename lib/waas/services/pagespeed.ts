// =============================================================================
// Google PageSpeed Insights API Integration
// Provides Core Web Vitals + SEO scores for the target URL
// Docs: https://developers.google.com/speed/docs/insights/v5/get-started
// Free API key: https://console.cloud.google.com (PageSpeed Insights API)
// =============================================================================

export interface PageSpeedMetrics {
  // Core Web Vitals
  lcp:   number   // Largest Contentful Paint (ms)
  fid:   number   // First Input Delay (ms) — approximated by TBT
  cls:   number   // Cumulative Layout Shift (unitless)
  ttfb:  number   // Time to First Byte (ms)
  fcp:   number   // First Contentful Paint (ms)
  si:    number   // Speed Index (ms)
  tbt:   number   // Total Blocking Time (ms)
}

export interface PageSpeedCategoryScore {
  score: number   // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export interface PageSpeedReport {
  url:             string
  mobile:          PageSpeedMetrics & { categoryScores: PageSpeedCategoryScores }
  desktop:         PageSpeedMetrics & { categoryScores: PageSpeedCategoryScores }
  overallScore:    number    // 0-100 weighted average
  grade:           'A' | 'B' | 'C' | 'D' | 'F'
  opportunities:   PageSpeedOpportunity[]
  diagnostics:     PageSpeedDiagnostic[]
  fetchedAt:       string
}

export interface PageSpeedCategoryScores {
  performance:    PageSpeedCategoryScore
  seo:            PageSpeedCategoryScore
  accessibility:  PageSpeedCategoryScore
  bestPractices:  PageSpeedCategoryScore
}

export interface PageSpeedOpportunity {
  id:           string
  title:        string
  description:  string
  savings_ms:   number   // estimated time savings in ms
  impact:       'critical' | 'warning' | 'info'
}

export interface PageSpeedDiagnostic {
  id:          string
  title:       string
  description: string
  score:       number | null
}

const REQUIRED_CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'] as const
const PAGESPEED_TIMEOUT_MS = 90_000
const PAGESPEED_503_RETRY_DELAY_MS = 2_000

export class PageSpeedDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PageSpeedDataError'
  }
}

type PageSpeedFailureReason = 'timeout' | 'http-503' | 'http-error' | 'network-error' | 'parse-error'

interface PageSpeedFetchError {
  reason: PageSpeedFailureReason
  status?: number
  message: string
}

interface PageSpeedFetchResult {
  data: Record<string, any> | null
  error: PageSpeedFetchError | null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false

  const e = err as { name?: string; message?: string }
  return e.name === 'TimeoutError' ||
    e.name === 'AbortError' ||
    e.message?.toLowerCase().includes('timed out') === true ||
    e.message?.toLowerCase().includes('timeout') === true
}

// ---------------------------------------------------------------------------
// Convert 0-1 score to letter grade
// ---------------------------------------------------------------------------
function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 60) return 'C'
  if (score >= 40) return 'D'
  return 'F'
}

// ---------------------------------------------------------------------------
// Extract metrics from PageSpeed API response
// ---------------------------------------------------------------------------
function extractMetrics(
  lighthouseResult: Record<string, any>
): PageSpeedMetrics {
  const audits = lighthouseResult?.audits ?? {}

  return {
    lcp:  Math.round((audits['largest-contentful-paint']?.numericValue  ?? 0)),
    fid:  Math.round((audits['total-blocking-time']?.numericValue        ?? 0)),
    cls:  parseFloat((audits['cumulative-layout-shift']?.numericValue    ?? 0).toFixed(3)),
    ttfb: Math.round((audits['server-response-time']?.numericValue       ?? 0)),
    fcp:  Math.round((audits['first-contentful-paint']?.numericValue     ?? 0)),
    si:   Math.round((audits['speed-index']?.numericValue                ?? 0)),
    tbt:  Math.round((audits['total-blocking-time']?.numericValue        ?? 0)),
  }
}

// ---------------------------------------------------------------------------
// Extract category scores
// ---------------------------------------------------------------------------
function extractCategoryScores(
  lighthouseResult: Record<string, any>,
  strategy: 'mobile' | 'desktop'
): PageSpeedCategoryScores {
  const cats = lighthouseResult?.categories ?? {}

  const scores: Record<(typeof REQUIRED_CATEGORIES)[number], number> = {
    performance: 0,
    seo: 0,
    accessibility: 0,
    'best-practices': 0,
  }

  for (const category of REQUIRED_CATEGORIES) {
    const rawScore = cats?.[category]?.score

    if (rawScore === null || rawScore === undefined) {
      throw new PageSpeedDataError(
        `[PageSpeed] ${strategy} response missing category score for "${category}".`
      )
    }

    if (typeof rawScore !== 'number' || Number.isNaN(rawScore)) {
      throw new PageSpeedDataError(
        `[PageSpeed] ${strategy} response has invalid category score for "${category}": ${String(rawScore)}`
      )
    }

    scores[category] = Math.round(rawScore * 100)
  }

  const perf = scores.performance
  const seo = scores.seo
  const a11y = scores.accessibility
  const bp = scores['best-practices']

  return {
    performance:   { score: perf,  grade: scoreToGrade(perf)  },
    seo:           { score: seo,   grade: scoreToGrade(seo)   },
    accessibility: { score: a11y,  grade: scoreToGrade(a11y)  },
    bestPractices: { score: bp,    grade: scoreToGrade(bp)    },
  }
}

// ---------------------------------------------------------------------------
// Extract improvement opportunities
// ---------------------------------------------------------------------------
function extractOpportunities(
  lighthouseResult: Record<string, any>
): PageSpeedOpportunity[] {
  const audits = lighthouseResult?.audits ?? {}
  const opportunities: PageSpeedOpportunity[] = []

  const opportunityIds = [
    'render-blocking-resources',
    'unused-css-rules',
    'unused-javascript',
    'uses-optimized-images',
    'uses-webp-images',
    'uses-text-compression',
    'uses-long-cache-ttl',
    'efficient-animated-content',
  ]

  for (const id of opportunityIds) {
    const audit = audits[id]
    if (!audit || audit.score === 1) continue

    const savings = audit.details?.overallSavingsMs ?? 0

    opportunities.push({
      id,
      title:       audit.title       ?? id,
      description: audit.description ?? '',
      savings_ms:  Math.round(savings),
      impact:      savings > 1000 ? 'critical' : savings > 300 ? 'warning' : 'info',
    })
  }

  return opportunities.sort((a, b) => b.savings_ms - a.savings_ms).slice(0, 5)
}

// ---------------------------------------------------------------------------
// Fetch PageSpeed data for a single strategy (mobile or desktop)
// ---------------------------------------------------------------------------
async function fetchPageSpeed(
  url:      string,
  strategy: 'mobile' | 'desktop'
): Promise<PageSpeedFetchResult> {
  const apiKey = process.env.PAGESPEED_API_KEY

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url',      url)
  endpoint.searchParams.set('strategy', strategy)
  endpoint.searchParams.append('category', 'performance')
  endpoint.searchParams.append('category', 'seo')
  endpoint.searchParams.append('category', 'accessibility')
  endpoint.searchParams.append('category', 'best-practices')
  if (apiKey) endpoint.searchParams.set('key', apiKey)

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(endpoint.toString(), {
        cache: 'no-store',
        signal: AbortSignal.timeout(PAGESPEED_TIMEOUT_MS),
      })

      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 503 && attempt === 1) {
          console.warn(
            `[PageSpeed] ${strategy} returned 503. Retrying once after ${PAGESPEED_503_RETRY_DELAY_MS}ms.`
          )
          await sleep(PAGESPEED_503_RETRY_DELAY_MS)
          continue
        }

        console.error(`[PageSpeed] ${strategy} error ${response.status}:`, errorText.slice(0, 200))
        return {
          data: null,
          error: {
            reason: response.status === 503 ? 'http-503' : 'http-error',
            status: response.status,
            message: errorText.slice(0, 200) || `HTTP ${response.status}`,
          },
        }
      }

      return {
        data: await response.json(),
        error: null,
      }
    } catch (err) {
      if (isTimeoutError(err)) {
        console.error(`[PageSpeed] ${strategy} timeout after ${PAGESPEED_TIMEOUT_MS}ms.`)
        return {
          data: null,
          error: {
            reason: 'timeout',
            message: `Timeout after ${PAGESPEED_TIMEOUT_MS}ms`,
          },
        }
      }

      console.error(`[PageSpeed] ${strategy} fetch error:`, err)
      return {
        data: null,
        error: {
          reason: 'network-error',
          message: String(err),
        },
      }
    }
  }

  return {
    data: null,
    error: {
      reason: 'http-503',
      status: 503,
      message: 'PageSpeed service unavailable after retry.',
    },
  }
}

// ---------------------------------------------------------------------------
// Main: Run full PageSpeed audit (mobile + desktop)
// ---------------------------------------------------------------------------
export async function runPageSpeedAudit(url: string): Promise<PageSpeedReport | null> {
  // Run mobile and desktop in parallel
  const [mobileResult, desktopResult] = await Promise.all([
    fetchPageSpeed(url, 'mobile'),
    fetchPageSpeed(url, 'desktop'),
  ])

  const mobileData = mobileResult.data
  const desktopData = desktopResult.data

  if (!mobileData && !desktopData) {
    throw new PageSpeedDataError(
      `Both PageSpeed strategies failed. mobile=${mobileResult.error?.reason ?? 'unknown'} desktop=${desktopResult.error?.reason ?? 'unknown'}`
    )
  }

  // We use mobile categories as the primary SEO/UX signal in report summaries.
  // If mobile is unavailable, we still cannot produce stable summary fields.
  if (!mobileData) return null

  const desktopTimedOut = desktopResult.error?.reason === 'timeout'
  if (!desktopData && desktopTimedOut) {
    console.warn('[PageSpeed] Desktop strategy timed out; using mobile metrics/categories as fallback for desktop.')
  } else if (!desktopData) {
    console.warn('[PageSpeed] Desktop strategy unavailable; using mobile-only fallback for desktop metrics.')
  }

  const mobileLH  = mobileData?.lighthouseResult  ?? {}
  const desktopLH = desktopData?.lighthouseResult ?? mobileLH

  const mobileMetrics  = extractMetrics(mobileLH)
  const desktopMetrics = extractMetrics(desktopLH)

  const mobileCats  = extractCategoryScores(mobileLH, 'mobile')
  const desktopCats = extractCategoryScores(desktopLH, 'desktop')

  const opportunities = extractOpportunities(mobileLH)
  const diagnostics   = extractDiagnostics(mobileLH)

  // Overall score = weighted avg (mobile performance counts more for local biz)
  const overallScore = Math.round(
    (mobileCats.performance.score  * 0.35) +
    (mobileCats.seo.score          * 0.30) +
    (desktopCats.performance.score * 0.20) +
    (mobileCats.accessibility.score * 0.15)
  )

  return {
    url,
    mobile:       { ...mobileMetrics,  categoryScores: mobileCats  },
    desktop:      { ...desktopMetrics, categoryScores: desktopCats },
    overallScore,
    grade:        scoreToGrade(overallScore),
    opportunities,
    diagnostics,
    fetchedAt:    new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Extract SEO diagnostics
// ---------------------------------------------------------------------------
function extractDiagnostics(lighthouseResult: Record<string, any>): PageSpeedDiagnostic[] {
  const audits = lighthouseResult?.audits ?? {}
  const diagnosticIds = [
    'document-title',
    'meta-description',
    'http-status-code',
    'link-text',
    'crawlable-anchors',
    'is-crawlable',
    'robots-txt',
    'image-alt',
    'hreflang',
    'canonical',
    'structured-data',
  ]

  return diagnosticIds
    .filter(id => audits[id])
    .map(id => ({
      id,
      title:       audits[id].title       ?? id,
      description: audits[id].description ?? '',
      score:       audits[id].score !== null ? Math.round((audits[id].score ?? 0) * 100) : null,
    }))
    .filter(d => d.score !== null && d.score < 100)
    .slice(0, 8)
}

// ---------------------------------------------------------------------------
// MOCK: Realistic data for dev/testing (no API key needed)
// ---------------------------------------------------------------------------
export function getMockPageSpeedReport(url: string): PageSpeedReport {
  // Mock poor scores for the prospect (that's the point — show them they need help)
  const mobilePerf  = Math.floor(Math.random() * 25) + 20   // 20-45 (poor)
  const mobileSeo   = Math.floor(Math.random() * 20) + 35   // 35-55 (mediocre)
  const desktopPerf = Math.floor(Math.random() * 20) + 45   // 45-65 (average)
  const overallScore = Math.round(mobilePerf * 0.35 + mobileSeo * 0.30 + desktopPerf * 0.20 + 50 * 0.15)

  return {
    url,
    mobile: {
      lcp:  4200 + Math.random() * 2000,
      fid:  380  + Math.random() * 200,
      cls:  0.18 + Math.random() * 0.15,
      ttfb: 820  + Math.random() * 400,
      fcp:  3100 + Math.random() * 1000,
      si:   5200 + Math.random() * 2000,
      tbt:  650  + Math.random() * 300,
      categoryScores: {
        performance:   { score: mobilePerf,                  grade: scoreToGrade(mobilePerf)                  },
        seo:           { score: mobileSeo,                   grade: scoreToGrade(mobileSeo)                   },
        accessibility: { score: 62,                          grade: 'C'                                       },
        bestPractices: { score: 58,                          grade: 'C'                                       },
      },
    },
    desktop: {
      lcp:  2100 + Math.random() * 1000,
      fid:  120  + Math.random() * 100,
      cls:  0.08 + Math.random() * 0.08,
      ttfb: 420  + Math.random() * 200,
      fcp:  1800 + Math.random() * 600,
      si:   3200 + Math.random() * 1000,
      tbt:  280  + Math.random() * 150,
      categoryScores: {
        performance:   { score: desktopPerf,                 grade: scoreToGrade(desktopPerf)                 },
        seo:           { score: mobileSeo + 8,               grade: scoreToGrade(mobileSeo + 8)               },
        accessibility: { score: 68,                          grade: 'C'                                       },
        bestPractices: { score: 65,                          grade: 'C'                                       },
      },
    },
    overallScore,
    grade: scoreToGrade(overallScore),
    opportunities: [
      { id: 'unused-javascript',      title: 'Remove Unused JavaScript',      description: 'Reduce unused JS to decrease bytes consumed by network activity.',  savings_ms: 1840, impact: 'critical' },
      { id: 'render-blocking-resources', title: 'Eliminate Render-Blocking Resources', description: 'Resources are blocking the first paint of your page.',    savings_ms: 1230, impact: 'critical' },
      { id: 'uses-optimized-images',  title: 'Efficiently Encode Images',     description: 'Optimized images load faster and consume less cellular data.',      savings_ms:  890, impact: 'warning'  },
      { id: 'uses-text-compression',  title: 'Enable Text Compression',       description: 'Text-based resources should be served with compression.',           savings_ms:  420, impact: 'warning'  },
      { id: 'uses-webp-images',       title: 'Serve Images in Next-Gen Formats', description: 'WebP and AVIF provide better compression than PNG or JPEG.',     savings_ms:  310, impact: 'info'     },
    ],
    diagnostics: [
      { id: 'meta-description',  title: 'Document does not have a meta description', description: 'Meta descriptions may be included in search results.', score: 0   },
      { id: 'structured-data',   title: 'Structured data is not valid',              description: 'Run validation for structured data errors.',             score: 0   },
      { id: 'image-alt',         title: 'Image elements do not have alt attributes', description: 'Informative elements should aim for short, descriptive alt text.', score: 0 },
    ],
    fetchedAt: new Date().toISOString(),
  }
}