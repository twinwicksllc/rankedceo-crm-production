import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
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
  return (
    <html lang="en">
      <head>
        <script
          src="https://www.google.com/recaptcha/api.js?render=6LeaeFUsAAAAAKr8KyPJu0B5njqb3Ha_bqeUrWQ6"
          async
          defer
        ></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  )
}