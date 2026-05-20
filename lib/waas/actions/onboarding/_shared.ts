import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Raw client helper (bypasses ExactMatch type system)
// ---------------------------------------------------------------------------

export function getRawClient() {
  const url  = process.env.NEXT_PUBLIC_WAAS_SUPABASE_URL
  const key  = process.env.WAAS_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('WaaS Supabase env vars not set')
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// ---------------------------------------------------------------------------
// Action Result type
// ---------------------------------------------------------------------------

export interface ActionResult<T = null> {
  success: boolean
  data?:   T
  error?:  string
}

// ---------------------------------------------------------------------------
// Tenant write helpers (schema-cache safe)
// ---------------------------------------------------------------------------

export function parseMissingTenantColumn(errorMessage: string): string | null {
  const match = errorMessage.match(/Could not find the '([^']+)' column of 'tenants' in the schema cache/i)
  return match?.[1] ?? null
}

export function isPendingReviewEnumError(errorMessage: string): boolean {
  return /invalid input value for enum .*pending_review/i.test(errorMessage)
}

export function isMissingSchemaTable(errorMessage: string, tableName: string): boolean {
  const escaped = tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`Could not find the table 'public\\.${escaped}' in the schema cache`, 'i')
  return re.test(errorMessage)
}

export function isMissingBucketError(errorMessage: string, bucketName: string): boolean {
  const escaped = bucketName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`bucket.*${escaped}.*(not found|does not exist)|not found`, 'i')
  return re.test(errorMessage)
}

export async function ensureLogosBucket(supabase: ReturnType<typeof getRawClient>): Promise<{ error: { message: string } | null }> {
  const { data, error } = await supabase.storage.getBucket('logos')
  if (!error && data) {
    return { error: null }
  }

  if (error && !isMissingBucketError(error.message, 'logos')) {
    return { error: { message: error.message } }
  }

  const { error: createError } = await supabase.storage.createBucket('logos', {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
  })

  if (createError && !/already exists|duplicate/i.test(createError.message)) {
    return { error: { message: createError.message } }
  }

  return { error: null }
}

export async function updateTenantWithFallback(
  supabase: ReturnType<typeof getRawClient>,
  tenantId: string,
  payload: Record<string, unknown>
): Promise<{ error: { message: string } | null }> {
  const mutablePayload: Record<string, unknown> = { ...payload }

  // Retry after removing unknown columns reported by schema cache.
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { error } = await supabase
      .from('tenants')
      .update(mutablePayload)
      .eq('id', tenantId)

    if (!error) return { error: null }

    const missingColumn = parseMissingTenantColumn(error.message)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      continue
    }

    if (isPendingReviewEnumError(error.message) && mutablePayload.status === 'pending_review') {
      mutablePayload.status = 'onboarding'
      continue
    }

    return { error: { message: error.message } }
  }

  return { error: { message: 'Tenant update failed after schema fallback retries.' } }
}

export async function insertTenantWithFallback(
  supabase: ReturnType<typeof getRawClient>,
  payload: Record<string, unknown>
): Promise<{ id?: string; error: { message: string } | null }> {
  const mutablePayload: Record<string, unknown> = { ...payload }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const { data: inserted, error } = await supabase
      .from('tenants')
      .insert(mutablePayload)
      .select('id')
      .single()

    if (!error) {
      return { id: (inserted as { id: string }).id, error: null }
    }

    const missingColumn = parseMissingTenantColumn(error.message)
    if (missingColumn && missingColumn in mutablePayload) {
      delete mutablePayload[missingColumn]
      continue
    }

    if (isPendingReviewEnumError(error.message) && mutablePayload.status === 'pending_review') {
      mutablePayload.status = 'onboarding'
      continue
    }

    return { error: { message: error.message } }
  }

  return { error: { message: 'Tenant insert failed after schema fallback retries.' } }
}
