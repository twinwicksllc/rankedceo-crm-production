'use client'

// =============================================================================
// Step 2: Domain Wishlist
// =============================================================================

import React, { useState } from 'react'
import type { DomainWishlistItem } from '@/lib/waas/types'

const EXTENSIONS: DomainWishlistItem['extension'][] = ['.com', '.net', '.biz', '.org', '.co', '.io']

interface Props {
  domains:    DomainWishlistItem[]
  setDomains: (d: DomainWishlistItem[]) => void
  onNext:     () => void
  onBack:     () => void
  isLoading:  boolean
}

export function StepDomainWishlist({ domains, setDomains, onNext, onBack, isLoading }: Props) {
  const [domainInput, setDomainInput] = useState('')
  const [selectedExt, setSelectedExt] = useState<DomainWishlistItem['extension']>('.com')
  const [inputError,  setInputError]  = useState('')

  const MAX_DOMAINS = 3

  const sanitizeDomain = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '')

  const handleAdd = () => {
    setInputError('')
    const name = sanitizeDomain(domainInput.trim())
    if (!name) { setInputError('Please enter a domain name.'); return }
    if (name.length < 2) { setInputError('Domain must be at least 2 characters.'); return }
    if (domains.length >= MAX_DOMAINS) { setInputError('Maximum 3 domains allowed.'); return }
    if (domains.some(d => d.domain_name === name && d.extension === selectedExt)) {
      setInputError('That domain + extension combo is already added.')
      return
    }
    const newDomain: DomainWishlistItem = {
      domain_name: name,
      extension:   selectedExt,
      priority:    (domains.length + 1) as 1 | 2 | 3,
    }
    setDomains([...domains, newDomain])
    setDomainInput('')
  }

  const handleRemove = (i: number) => {
    const updated = domains
      .filter((_, idx) => idx !== i)
      .map((d, idx) => ({ ...d, priority: (idx + 1) as 1 | 2 | 3 }))
    setDomains(updated)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
  }

  const priorityLabels = ['1st Choice', '2nd Choice', '3rd Choice']
  const priorityColors = [
    'from-blue-500 to-blue-600',
    'from-violet-500 to-violet-600',
    'from-indigo-500 to-indigo-600',
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">Step 2 of 4</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
          Choose your dream domain
        </h1>
        <p className="text-white/50 mt-2 text-sm sm:text-base">
          Add up to 3 domain preferences. We'll check availability and secure the best option for you.
        </p>
      </div>

      {/* Domain input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-white/70 mb-3">
          Enter a domain name
        </label>
        <div className="flex gap-3">
          {/* Domain input */}
          <div className="flex-1 flex items-center h-14 rounded-xl bg-white/5 border border-white/10 focus-within:border-blue-500/60 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all overflow-hidden">
            <input
              type="text"
              value={domainInput}
              onChange={e => setDomainInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="acmeplumbing"
              maxLength={50}
              className="flex-1 h-full px-4 bg-transparent text-white placeholder:text-white/25 text-sm sm:text-base outline-none"
            />
            {/* Extension selector */}
            <select
              value={selectedExt}
              onChange={e => setSelectedExt(e.target.value as DomainWishlistItem['extension'])}
              className="h-full px-3 bg-white/10 text-white text-sm font-medium border-l border-white/10 outline-none cursor-pointer [&_option]:bg-[#0A0F1E]"
            >
              {EXTENSIONS.map(ext => (
                <option key={ext} value={ext}>{ext}</option>
              ))}
            </select>
          </div>

          {/* Add button */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={domains.length >= MAX_DOMAINS}
            className="h-14 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-blue-600/25 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            Add
          </button>
        </div>
        {inputError && (
          <p className="mt-2 text-xs text-red-400">{inputError}</p>
        )}
        <p className="mt-2 text-xs text-white/30">
          {domains.length}/{MAX_DOMAINS} domains added • Letters, numbers, and hyphens only
        </p>
      </div>

      {/* Domain list */}
      {domains.length > 0 ? (
        <div className="space-y-3 mb-8">
          {domains.map((d, i) => (
            <div
              key={`${d.domain_name}${d.extension}`}
              className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/10"
            >
              {/* Priority badge */}
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br ${priorityColors[i]} text-white text-xs font-bold shrink-0`}>
                {i + 1}
              </div>

              {/* Domain */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-white font-semibold text-sm sm:text-base truncate">
                    {d.domain_name}
                  </span>
                  <span className="text-blue-400 font-medium text-sm sm:text-base">
                    {d.extension}
                  </span>
                </div>
                <span className="text-white/30 text-xs">{priorityLabels[i]}</span>
              </div>

              {/* Status badge */}
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-amber-400 text-xs font-medium">Requested</span>
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => handleRemove(i)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-dashed border-white/10 mb-8">
          <div className="text-3xl mb-3">🌐</div>
          <p className="text-white/30 text-sm text-center">No domains added yet.<br/>Add at least one to continue.</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-14 px-6 rounded-xl border border-white/15 text-white/60 hover:text-white hover:border-white/30 font-medium text-sm transition-all"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || domains.length === 0}
          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="3" strokeOpacity="0.25"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              Saving…
            </>
          ) : (
            <>Continue to Brand Identity <span className="ml-1">→</span></>
          )}
        </button>
      </div>
    </div>
  )
}