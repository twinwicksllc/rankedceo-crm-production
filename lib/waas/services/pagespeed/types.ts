// lib/waas/services/pagespeed/types.ts
// ======================================================================
// Google PageSpeed Insights API Integration
// Provides Core Web Vitals + SEO scores for the target URL// Docs: https://developers.google.com/speed/docs/insights/v5/get-started
// Free API key: https://console.cloud.google.com (PageSpeed Insights API)
// =========================================================================

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
  url:            string
  mobile:         PageSpeedMetrics & { categoryScores: PageSpeedCategoryScores }
  desktop:        PageSpeedMetrics & { categoryScores: PageSpeedCategoryScores }
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

export const REQUIRED_CATEGORIES = ['performance', 'seo', 'accessibility', 'best-practices'] as const
export const PAGESPEED_TIMEOUT_MS = 90_000
export const PAGESPEED_503_RETRY_DELAY_MS = 2_000

export class PageSpeedDataError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PageSpeedDataError'
  }
}

export type PageSpeedFailureReason = 'timeout' | 'http-503' | 'http-error' | 'network-error' | 'parse-error'

export interface PageSpeedFetchError {
  reason: PageSpeedFailureReason
  status?: number
  message: string
}

export interface PageSpeedFetchResult {
  data: Record<string, any> | null
  error: PageSpeedFetchError | null
}