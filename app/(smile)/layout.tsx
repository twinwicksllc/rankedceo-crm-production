import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Smile MakeOver - Dentist Dashboard',
  description: 'Patient qualification and case mix revenue management for dental practices',
}

export default function SmileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
