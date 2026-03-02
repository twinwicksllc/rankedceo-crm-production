'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { IndustryLogo, type IndustryType } from '@/components/ui/industry-logo'

// Map subdomains to industry types
const SUBDOMAIN_TO_INDUSTRY: Record<string, IndustryType> = {
  hvac: 'hvac',
  plumbing: 'plumbing',
  electrical: 'electrical',
  smile: 'smile',
}

function detectIndustry(): IndustryType | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname // e.g. "hvac.rankedceo.com"
  const subdomain = hostname.split('.')[0]
  return SUBDOMAIN_TO_INDUSTRY[subdomain] ?? null
}

export function SidebarLogo() {
  const [industry, setIndustry] = useState<IndustryType | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setIndustry(detectIndustry())
    setMounted(true)
  }, [])

  // During SSR or before mount, show RankedCEO logo (avoids layout shift)
  if (!mounted) {
    return (
      <div className="p-4 bg-black flex items-center justify-center min-h-[72px]">
        <Image
          src="/ranked_logo.png"
          alt="RankedCEO"
          width={160}
          height={64}
          className="h-10 w-auto"
          priority
        />
      </div>
    )
  }

  // If on an industry subdomain, show the industry logo on white background
  if (industry) {
    return (
      <div className="p-4 bg-white border-b border-gray-100 flex items-center justify-center min-h-[72px]">
        <IndustryLogo
          industry={industry}
          height={48}
          priority
          className="mx-auto"
        />
      </div>
    )
  }

  // Default: RankedCEO logo on black background (main CRM)
  return (
    <div className="p-4 bg-black flex items-center justify-center min-h-[72px]">
      <Image
        src="/ranked_logo.png"
        alt="RankedCEO"
        width={160}
        height={64}
        className="h-10 w-auto"
        priority
      />
    </div>
  )
}