import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Audit Pro by RankedCEO | Free Competitive SEO Audit',
  description:
    'Run a fast SEO and competitor audit with Audit Pro by RankedCEO. Compare your site performance, SEO, and user experience against local competitors.',
}

export default function AuditStartLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
