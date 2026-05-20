// lib/waas/services/keyword-generator/types.ts

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const GEMINI_MODEL = 'gemini-2.5-flash'
export const DEFAULT_LOCATION = 'Chicago, IL'
export const SITE_FETCH_TIMEOUT_MS = 12000
export const MAX_SITE_TEXT_CHARS = 12000

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

export interface SiteSignals {
  domain: string
  homepageUrl: string
  pageUrls: string[]
  fetchedPages: number
  textSnippet: string
  titleHints: string[]
  addressHint: string | null
  locationHint: string | null
}

export interface AiKeywordPlan {
  industry: string | null
  location: string | null
  address: string | null
  keywords: string[]
}
