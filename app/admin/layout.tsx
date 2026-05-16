// =============================================================================
// RankedCEO CRM — Admin Layout
// Protected route — checks for admin session
// =============================================================================

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdvantagePointHeader } from '@/components/advantagepoint/header'
import { AdvantagePointFooter } from '@/components/advantagepoint/footer'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Command Center | RankedCEO',
  description: 'RankedCEO Admin Dashboard',
  robots: 'noindex, nofollow',
}

function parseAdminAllowlist(): string[] {
  const raw = process.env.WAAS_ADMIN_EMAILS ?? process.env.WAAS_ADMIN_EMAIL ?? ''
  return raw
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
}

type SessionType = Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getSession']>>['data']['session']

async function isAdminSession(
  supabase: Awaited<ReturnType<typeof createClient>>,
  session: SessionType,
): Promise<boolean> {
  const user = session?.user
  if (!user) return false

  const email = user.email?.toLowerCase() ?? ''
  const allowlist = parseAdminAllowlist()

  const hasAllowlistedEmail = allowlist.length > 0 && allowlist.includes(email)
  const hasAdminRoleFlag = user.app_metadata?.role === 'waas_admin' || user.app_metadata?.waas_admin === true || user.app_metadata?.waas_admin === 'true'

  if (hasAllowlistedEmail || hasAdminRoleFlag) {
    return true
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const dbRole = typeof dbUser?.role === 'string' ? dbUser.role.toLowerCase() : ''
  const allowedDbRoles = new Set(['admin', 'super_admin', 'owner'])
  const hasDbAdminRole = allowedDbRoles.has(dbRole)

  return hasDbAdminRole
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Auth check via CRM Supabase (same auth as the main CRM dashboard)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/admin/dashboard&adminOnly=1')
  }

  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login?next=/admin/dashboard&adminOnly=1')
  }

  const hasAdminAccess = await isAdminSession(supabase, session)
  if (!hasAdminAccess) {
    redirect('/login?error=Admin%20access%20required&next=/admin/dashboard&adminOnly=1')
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] relative overflow-hidden flex flex-col">
      {/* Ambient glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-600/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
                              linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <AdvantagePointHeader variant="admin" />

      <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-8">
        {children}
      </main>

      <AdvantagePointFooter />
    </div>
  )
}