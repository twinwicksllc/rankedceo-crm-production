import Link from 'next/link'

export default function EditorNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-900 mb-2">
          We couldn&apos;t find this edit session
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          This link may have expired, or the website hasn&apos;t been prepared for review yet.
          Please check your email for the most recent edit link, or contact our team for help.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go home
          </Link>
          <a
            href="mailto:support@rankedceo.com"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Email support
          </a>
        </div>
      </div>
    </div>
  )
}
