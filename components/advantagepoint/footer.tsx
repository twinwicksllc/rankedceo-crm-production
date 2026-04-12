// =============================================================================
// AdvantagePoint — Shared Footer Component
// =============================================================================

import React from 'react'

export function AdvantagePointFooter() {
  return (
    <footer className="relative z-10 border-t border-white/10 py-6 mt-auto">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L3 7v11h5v-6h4v6h5V7L10 2z" fill="white"/>
            </svg>
          </div>
          <span className="text-white/40 text-xs font-medium">
            © {new Date().getFullYear()} AdvantagePoint. All rights reserved.
          </span>
        </div>
        <div className="flex items-center gap-4 text-white/30 text-xs">
          <a href="/privacy" className="hover:text-white/60 transition-colors">Privacy</a>
          <a href="/terms" className="hover:text-white/60 transition-colors">Terms</a>
          <a href="mailto:support@advantagepoint.com" className="hover:text-white/60 transition-colors">Support</a>
        </div>
      </div>
    </footer>
  )
}