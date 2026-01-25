import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { RecaptchaProvider } from '@/components/recaptcha-provider'

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
  return (
    <html lang="en">
      <body className={inter.className}>
        <RecaptchaProvider />
        {children}
      </body>
    </html>
  )
}