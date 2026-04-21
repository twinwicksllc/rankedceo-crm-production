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
  const [competitor1, setCompetitor1] = useState('')
  const [competitor2, setCompetitor2] = useState('')
  const [competitor3, setCompetitor3] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submitAudit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const competitors = [competitor1, competitor2, competitor3].map(v => v.trim()).filter(Boolean)

    try {
      const response = await fetch('/api/audit/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_url: targetUrl,
          competitor_urls: competitors,
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

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Start Your Free Audit</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Enter your website and up to 3 competitor sites. We will generate your report in a few minutes.
        </p>

        <form onSubmit={submitAudit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="targetUrl" className="mb-1 block text-sm font-medium text-slate-700">
              Your Website URL
            </label>
            <input
              id="targetUrl"
              type="text"
              required
              placeholder="example.com"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring"
            />
          </div>

          <div>
            <label htmlFor="competitor1" className="mb-1 block text-sm font-medium text-slate-700">
              Competitor URL 1 (required)
            </label>
            <input
              id="competitor1"
              type="text"
              required
              placeholder="competitor.com"
              value={competitor1}
              onChange={(e) => setCompetitor1(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring"
            />
          </div>

          <div>
            <label htmlFor="competitor2" className="mb-1 block text-sm font-medium text-slate-700">
              Competitor URL 2 (optional)
            </label>
            <input
              id="competitor2"
              type="text"
              placeholder="competitor-two.com"
              value={competitor2}
              onChange={(e) => setCompetitor2(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring"
            />
          </div>

          <div>
            <label htmlFor="competitor3" className="mb-1 block text-sm font-medium text-slate-700">
              Competitor URL 3 (optional)
            </label>
            <input
              id="competitor3"
              type="text"
              placeholder="competitor-three.com"
              value={competitor3}
              onChange={(e) => setCompetitor3(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-blue-500 focus:ring"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? 'Running Audit...' : 'Run Your Free Audit'}
          </button>
        </form>
      </div>
    </main>
  )
}
