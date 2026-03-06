import { Header } from "@/components/landing/header"
import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { SocialProof } from "@/components/landing/social-proof"
import { Pricing } from "@/components/landing/pricing"
import { CTA } from "@/components/landing/cta"
import { Footer } from "@/components/landing/footer"

export default function HomePage() {
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
