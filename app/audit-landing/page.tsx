import type { Metadata } from 'next'
import { AuditLandingContentWithTheme } from './audit-landing-content'

export const metadata: Metadata = {
  title: 'Free SEO Audit Tool | RankedCEO',
  description: 'Run a free SEO audit and compare your site against competitors with RankedCEO. Get instant visibility into performance, SEO gaps, and growth opportunities.',
  openGraph: {
    title: 'Free SEO Audit Tool | RankedCEO',
    description: 'Run a free SEO audit and compare your site against competitors with RankedCEO.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Free SEO Audit Tool | RankedCEO',
    description: 'Run a free SEO audit and compare your site against competitors with RankedCEO.',
  },
}

export default function AuditLandingPage() {
  return <AuditLandingContentWithTheme />
}