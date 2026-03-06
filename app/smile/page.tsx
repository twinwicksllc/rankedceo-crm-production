import { createClient } from '@/lib/supabase/server'
import SmileDashboard from './smile-dashboard'
import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { SocialProof } from "@/components/landing/social-proof"
import { Pricing } from "@/components/landing/pricing"
import { CTA } from "@/components/landing/cta"
import { Footer } from "@/components/landing/footer"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen">
        <Header />
        <Hero />
        <SocialProof />
        <Features />
        <Pricing />
        <CTA />
        <Footer />
      </main>
    )
  }

  // Get assessment count for this user
  const { count } = await supabase
    .from('smile_assessments')
    .select('*', { count: 'exact', head: true })
    .eq('auth_user_id', user.id)

  return <SmileDashboard userId={user.id} assessmentCount={count || 0} />
}
