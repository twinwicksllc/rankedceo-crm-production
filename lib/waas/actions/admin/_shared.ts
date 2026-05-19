// RankedCEO WaaS — Shared admin utilities (no 'use server' — helpers only)
import { createClient } from '@supabase/supabase-js'

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

export function parseMissingTenantColumn(msg: string): string | null {
  const match = msg.match(/column "([^"]+)" of relation "waas_tenants"/)
  return match ? match[1] : null
}

export function isPendingReviewEnumError(msg: string): boolean {
  return msg.includes('invalid input value for enum') && msg.includes('pending_review')
}

export function isMissingSchemaTable(msg: string): boolean {
  return (
    msg.includes('relation') &&
    (msg.includes('does not exist') || msg.includes('undefined')) &&
    msg.includes('waas')
  )
}
