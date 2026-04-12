// =============================================================================
// AdvantagePoint — Admin Layout
// Protected route — checks for admin session
// =============================================================================

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { AdvantagePointHeader } from '@/components/advantagepoint/header'
import { AdvantagePointFooter } from '@/components/advantagepoint/footer'

export const metadata: Metadata = {
  title: 'Command Center | AdvantagePoint',
  description: 'AdvantagePoint Admin Dashboard',
  robots: 'noindex, nofollow',
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Auth check via CRM Supabase (same auth as the main CRM dashboard)
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login?next=/admin/dashboard')
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