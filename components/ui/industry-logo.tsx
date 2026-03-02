'use client'

import Image from 'next/image'

export type IndustryType = 'hvac' | 'plumbing' | 'electrical' | 'smile'

interface IndustryLogoConfig {
  src: string
  alt: string
  brandName: string
}

const INDUSTRY_LOGOS: Record<IndustryType, IndustryLogoConfig> = {
  hvac: {
    src: '/logos/hvac-logo.png',
    alt: 'HVAC Pro by RankedCEO',
    brandName: 'HVAC Pro',
  },
  plumbing: {
    src: '/logos/plumbing-logo.png',
    alt: 'Plumb Pro by RankedCEO',
    brandName: 'Plumb Pro',
  },
  electrical: {
    src: '/logos/electrical-logo.png',
    alt: 'SPARK Pro by RankedCEO',
    brandName: 'SPARK Pro',
  },
  smile: {
    src: '/logos/smile-logo.png',
    alt: 'Smile Pro by RankedCEO',
    brandName: 'Smile Pro',
  },
}

interface IndustryLogoProps {
  industry: IndustryType | string
  className?: string
  height?: number
  width?: number
  priority?: boolean
  showFallback?: boolean
}

export function IndustryLogo({
  industry,
  className = '',
  height = 48,
  width,
  priority = true,
  showFallback = true,
}: IndustryLogoProps) {
  const config = INDUSTRY_LOGOS[industry as IndustryType]

  // Fallback: if industry not found, show RankedCEO text
  if (!config) {
    if (!showFallback) return null
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xl font-bold text-gray-900">RankedCEO</span>
      </div>
    )
  }

  // Calculate width proportionally if not provided (logos are ~3:1 ratio)
  const computedWidth = width ?? Math.round(height * 3.2)

  return (
    <Image
      src={config.src}
      alt={config.alt}
      height={height}
      width={computedWidth}
      priority={priority}
      className={`object-contain ${className}`}
      style={{ height: `${height}px`, width: 'auto' }}
    />
  )
}

// Helper to get brand name text (useful for page titles, meta, etc.)
export function getIndustryBrandName(industry: string): string {
  const config = INDUSTRY_LOGOS[industry as IndustryType]
  return config?.brandName ?? 'RankedCEO'
}

// Helper to get logo config
export function getIndustryLogoConfig(industry: string): IndustryLogoConfig | null {
  return INDUSTRY_LOGOS[industry as IndustryType] ?? null
}