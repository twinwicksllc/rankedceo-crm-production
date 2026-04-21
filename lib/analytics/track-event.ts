'use client'

import { track } from '@vercel/analytics'

type EventProperties = Record<string, string | number | boolean | null | undefined>

export function trackEvent(eventName: string, properties?: EventProperties) {
  try {
    track(eventName, properties)
  } catch {
    // Swallow analytics failures so user flow is never blocked by telemetry.
  }
}