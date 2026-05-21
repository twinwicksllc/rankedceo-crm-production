// TEMPORARY DEBUG ROUTE — remove after Phase 1 admin auth is confirmed working
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseAdminAllowlist(): string[] {
  const raw = process.env.WAAS_ADMIN_EMAILS ?? process.env.WAAS_ADMIN_EMAIL ?? ''
  return raw.split(',').map((email) => email.trim().toLowerCase()).filter(Boolean)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ authenticated: false, reason: 'no_session' })
  }

  const email = user.email?.toLowerCase() ?? ''
  const allowlist = parseAdminAllowlist()
  const hasAllowlistedEmail = allowlist.length > 0 && allowlist.includes(email)
  const hasAdminRoleFlag =
    user.app_metadata?.role === 'waas_admin' ||
    user.app_metadata?.waas_admin === true ||
    user.app_metadata?.waas_admin === 'true'

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const dbRole = typeof dbUser?.role === 'string' ? dbUser.role.toLowerCase() : null
  const hasDbAdminRole = ['admin', 'super_admin', 'owner'].includes(dbRole ?? '')

  return NextResponse.json({
    authenticated: true,
    email,
    allowlist,
    checks: {
      hasAllowlistedEmail,
      hasAdminRoleFlag,
      hasDbAdminRole,
      dbRole,
    },
    wouldGrantAccess: hasAllowlistedEmail || hasAdminRoleFlag || hasDbAdminRole,
    appMetadata: user.app_metadata,
    envVarRaw: process.env.WAAS_ADMIN_EMAILS ?? process.env.WAAS_ADMIN_EMAIL ?? '(not set)',
  })
}
