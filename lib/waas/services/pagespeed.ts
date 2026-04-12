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
  lighthouseResult: Record<string, any>
): PageSpeedCategoryScores {
  const cats = lighthouseResult?.categories ?? {}

  const perf  = Math.round((cats.performance?.score    ?? 0) * 100)
  const seo   = Math.round((cats.seo?.score            ?? 0) * 100)
  const a11y  = Math.round((cats.accessibility?.score  ?? 0) * 100)
  const bp    = Math.round((cats['best-practices']?.score ?? 0) * 100)

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
): Promise<Record<string, any> | null> {
  const apiKey = process.env.PAGESPEED_API_KEY

  const endpoint = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  endpoint.searchParams.set('url',      url)
  endpoint.searchParams.set('strategy', strategy)
  endpoint.searchParams.set('category', 'performance')
  endpoint.searchParams.set('category', 'seo')
  endpoint.searchParams.set('category', 'accessibility')
  endpoint.searchParams.set('category', 'best-practices')
  if (apiKey) endpoint.searchParams.set('key', apiKey)

  try {
    const response = await fetch(endpoint.toString(), {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),   // 30s timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[PageSpeed] ${strategy} error ${response.status}:`, errorText.slice(0, 200))
      return null
    }

    return await response.json()
  } catch (err) {
    console.error(`[PageSpeed] ${strategy} fetch error:`, err)
    return null
  }
}

// ---------------------------------------------------------------------------
// Main: Run full PageSpeed audit (mobile + desktop)
// ---------------------------------------------------------------------------
export async function runPageSpeedAudit(url: string): Promise<PageSpeedReport | null> {
  // Run mobile and desktop in parallel
  const [mobileData, desktopData] = await Promise.all([
    fetchPageSpeed(url, 'mobile'),
    fetchPageSpeed(url, 'desktop'),
  ])

  if (!mobileData && !desktopData) return null

  const mobileLH  = mobileData?.lighthouseResult  ?? {}
  const desktopLH = desktopData?.lighthouseResult ?? {}

  const mobileMetrics  = extractMetrics(mobileLH)
  const desktopMetrics = extractMetrics(desktopLH)

  const mobileCats  = extractCategoryScores(mobileLH)
  const desktopCats = extractCategoryScores(desktopLH)

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