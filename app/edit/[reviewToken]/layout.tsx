import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Edit your website | RankedCEO',
  description: 'Customize your new website before it goes live.',
  robots:      { index: false, follow: false },
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
