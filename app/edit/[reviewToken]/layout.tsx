// =============================================================================
// app/edit/[reviewToken]/layout.tsx
//
// Phase 6.1: The portal tab nav and chrome live inside portal-shell.tsx
// (a client component), so this layout is kept minimal — it just sets
// metadata and lets the page fill the full viewport.
// =============================================================================

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title:       'Your Website | RankedCEO',
  description: 'Manage and customise your website.',
  robots:      { index: false, follow: false },
}

export default function EditorLayout({ children }: { children: React.ReactNode }) {
  return children
}
