'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type AuditRunResponse = {
  audit_id?: string
  report_url?: string
  error?: string
}

export default function AuditStartPage() {
  const router = useRouter()
  const [targetUrl, setTargetUrl] = useState('')
  const [competitors, setCompetitors] = useState<string[]>([''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitAudit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const cleanedCompetitors = competitors.map((v) => v.trim()).filter(Boolean)

    try {
      const response = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: targetUrl,
          competitor_urls: cleanedCompetitors,
        }),
      })

      const data = (await response.json()) as AuditRunResponse

      if (!response.ok) {
        setError(data.error || 'Failed to start audit')
        setLoading(false)
        return
      }

      if (data.report_url) {
        router.push(data.report_url)
        return
      }

      if (data.audit_id) {
        router.push(`/audit/${data.audit_id}`)
        return
      }

      setError('Audit started but no report destination was returned.')
    } catch {
      setError('Could not start audit. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const updateCompetitor = (index: number, value: string) => {
    setCompetitors((current) => current.map((item, i) => (i === index ? value : item)))
  }

  const addCompetitor = () => {
    setCompetitors((current) => (current.length >= 3 ? current : [...current, '']))
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020b2c] px-4 py-10 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute -right-24 top-24 h-80 w-80 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="absolute bottom-0 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-700/25 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-3xl">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            See how you <span className="bg-gradient-to-r from-cyan-300 to-emerald-400 bg-clip-text text-transparent">stack up</span>
            <br />
            against competitors
          </h1>
          <p className="mt-4 text-base text-slate-300 sm:text-xl">
            Get detailed insights on performance, SEO, and user experience compared to your local competition.
          </p>
        </div>

        <div className="mt-8 rounded-3xl border border-cyan-400/20 bg-[#0a1a3b]/90 p-6 shadow-[0_0_50px_rgba(16,185,129,0.08)] backdrop-blur-xl sm:p-8">
          <form onSubmit={submitAudit} className="space-y-5">
            <div>
              <label htmlFor="targetUrl" className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-100">
                <span className="text-cyan-300">◎</span>
                Your Website
              </label>
              <input
                id="targetUrl"
                type="text"
                required
                placeholder="https://yourwebsite.com"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                className="h-12 w-full rounded-xl border border-cyan-200/15 bg-[#13284d] px-4 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-cyan-300/40 focus:ring-2 focus:ring-cyan-400/20"
              />
            </div>

            <div>
              <label className="mb-2 flex items-center gap-2 text-base font-semibold text-slate-100">
                <span className="text-emerald-300">◎</span>
                Competitor Websites
                <span className="text-sm font-medium text-slate-400">(up to 3)</span>
              </label>

              <div className="space-y-3">
                {competitors.map((value, index) => (
                  <div key={`competitor-${index}`} className="relative">
                    <input
                      id={`competitor${index + 1}`}
                      type="text"
                      required={index === 0}
                      placeholder={`https://competitor${index + 1}.com`}
                      value={value}
                      onChange={(e) => updateCompetitor(index, e.target.value)}
                      className="h-12 w-full rounded-xl border border-cyan-200/15 bg-[#13284d] px-4 text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-emerald-300/40 focus:ring-2 focus:ring-emerald-400/20"
                    />
                    {index === 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">
                        required
                      </span>
                    )}
                  </div>
                ))}

                {competitors.length < 3 && (
                  <button
                    type="button"
                    onClick={addCompetitor}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-cyan-200/20 bg-[#0f2448] text-sm font-semibold text-slate-300 transition hover:border-cyan-200/35 hover:text-white"
                  >
                    <span className="text-lg leading-none">＋</span>
                    Add another competitor
                  </button>
                )}
              </div>
            </div>

            {error ? <p className="text-sm font-medium text-rose-300">{error}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 h-14 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-lg font-extrabold text-[#052230] transition hover:from-cyan-400 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Running Audit...' : 'Run Your Free Audit'}
            </button>

            <div className="mt-2 border-t border-cyan-100/10 pt-6">
              <div className="grid grid-cols-3 gap-3 text-center text-xs text-slate-300 sm:text-sm">
                <div className="rounded-xl bg-[#13284d]/80 px-2 py-3">
                  <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">↗</div>
                  SEO Score
                </div>
                <div className="rounded-xl bg-[#13284d]/80 px-2 py-3">
                  <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">◎</div>
                  Performance
                </div>
                <div className="rounded-xl bg-[#13284d]/80 px-2 py-3">
                  <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15 text-cyan-300">◉</div>
                  UX Analysis
                </div>
              </div>
            </div>
          </form>
        </div>

        <p className="mt-7 text-center text-sm text-slate-400">No credit card required • Results in under 2 minutes</p>
      </div>
    </main>
  )
}
