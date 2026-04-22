'use client'

const LANDING_SESSION_STORAGE_KEY = 'audit_landing_session_id'
const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const

type EventProperties = Record<string, string | number | boolean | null | undefined>
type QueryValue = string | number | boolean | null | undefined

const DEFAULT_GET_STARTED_PATH = '/get-started'
const PRODUCTION_GET_STARTED_URL = 'https://audit.rankedceo.com/get-started'

function createLandingSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateLandingSessionId(): string | undefined {
  if (typeof window === 'undefined') return undefined

  try {
    const existing = window.sessionStorage.getItem(LANDING_SESSION_STORAGE_KEY)
    if (existing) return existing

    const sessionId = createLandingSessionId()
    window.sessionStorage.setItem(LANDING_SESSION_STORAGE_KEY, sessionId)
    return sessionId
  } catch {
    return undefined
  }
}

export function getUtmProperties(searchParams: URLSearchParams): EventProperties {
  return UTM_KEYS.reduce<EventProperties>((properties, key) => {
    const value = searchParams.get(key)
    if (value) {
      properties[key] = value
    }
    return properties
  }, {})
}

export function getReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined

  try {
    return new URL(document.referrer).hostname
  } catch {
    return document.referrer
  }
}

export function getAuditFunnelProperties(searchParams: URLSearchParams, auditId?: string | null): EventProperties {
  const landingSessionId = searchParams.get('landingSessionId') || getOrCreateLandingSessionId()

  return {
    auditId: auditId ?? searchParams.get('auditId') ?? undefined,
    landingSessionId,
    referrerHost: getReferrerHost(),
    ...getUtmProperties(searchParams),
  }
}

export function getGetStartedBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GET_STARTED_URL?.trim()
  if (configured) return configured

  if (typeof window === 'undefined') {
    return DEFAULT_GET_STARTED_PATH
  }

  const hostname = window.location.hostname

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.vercel.app')
  ) {
    return DEFAULT_GET_STARTED_PATH
  }

  if (hostname.endsWith('rankedceo.com')) {
    return PRODUCTION_GET_STARTED_URL
  }

  return DEFAULT_GET_STARTED_PATH
}

export function buildGetStartedUrl(
  basePath: string,
  searchParams: URLSearchParams,
  extraParams?: Record<string, QueryValue>
): string {
  const nextParams = new URLSearchParams()
  const landingSessionId = getOrCreateLandingSessionId()

  if (landingSessionId) {
    nextParams.set('landingSessionId', landingSessionId)
  }

  UTM_KEYS.forEach((key) => {
    const value = searchParams.get(key)
    if (value) {
      nextParams.set(key, value)
    }
  })

  Object.entries(extraParams ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      nextParams.set(key, String(value))
    }
  })

  const queryString = nextParams.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}