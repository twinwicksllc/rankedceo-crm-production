import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RankedCEO CRM',
  description: 'Multi-tenant CRM with AI-powered lead scoring',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY

  return (
    <html lang="en">
      <head>
        {siteKey && (
          <Script
            src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
            strategy="afterInteractive"
          />
        )}
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}