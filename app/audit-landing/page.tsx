import Link from 'next/link'
import { Shield, Zap, TrendingUp, Search, Clock, BarChart3 } from 'lucide-react'

// Always point auth links to the main domain, not the current subdomain
const LOGIN_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/login`
  : 'https://rankedceo.com/login'

const SIGNUP_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/signup`
  : 'https://rankedceo.com/signup'

export default function AuditLandingPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                <Search className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">RankedCEO</span>
              <span className="ml-2 rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-600">
                Audit Tool
              </span>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href={LOGIN_URL}
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                href={LOGIN_URL}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Start Free Audit
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
              <Clock className="h-4 w-4" />
              <span>Results in under 2 minutes</span>
            </div>
            <h1 className="mb-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
              See Your SEO Gaps
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {' '}
                vs. Competitors
              </span>
            </h1>
            <p className="mb-8 text-lg text-slate-600">
              Enter your competitor's website URL and get instant insights into their SEO strategy,
              performance scores, and growth opportunities. Stop guessing — start competing.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href={LOGIN_URL}
                className="flex w-full items-center justify-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl sm:w-auto"
              >
                <Shield className="mr-2 h-5 w-5" />
                Run Your Free Audit
              </Link>
              <Link
                href="#features"
                className="flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-8 py-3.5 text-base font-semibold text-slate-700 transition-all hover:bg-slate-50 sm:w-auto"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
              What the Audit Tells You
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-600">
              Comprehensive analysis across multiple dimensions of search performance
            </p>
          </div>
          
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: BarChart3,
                title: 'SEO Score',
                description: 'Comprehensive SEO health score based on meta tags, headings, content structure, and keyword optimization.',
              },
              {
                icon: Zap,
                title: 'Performance Score',
                description: 'Page speed metrics, Core Web Vitals, and loading performance analysis.',
              },
              {
                icon: TrendingUp,
                title: 'Competitor Analysis',
                description: 'Side-by-side comparison with industry leaders to identify what you\'re missing.',
              },
              {
                icon: Shield,
                title: 'Technical Audit',
                description: 'Check for broken links, sitemap issues, robots.txt problems, and mobile-friendliness.',
              },
              {
                icon: Search,
                title: 'Backlink Profile',
                description: 'Analyze competitor domain authority and backlink sources to build your strategy.',
              },
              {
                icon: Clock,
                title: 'Gap Analysis',
                description: 'Detailed report on specific keywords, rankings, and content gaps you need to address.',
              },
            ].map((feature, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 transition-all hover:border-blue-200 hover:shadow-lg"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500">
                  <feature.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-3 text-xl font-semibold text-slate-900">{feature.title}</h3>
                <p className="text-slate-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white sm:text-4xl">
              How It Works
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-300">
              Three simple steps to actionable competitor intelligence
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Enter Competitor URL',
                description: 'Paste any website URL you want to analyze. Works for any industry, any market.',
              },
              {
                step: '02',
                title: 'AI Analysis Runs',
                description: 'Our system crawls the site, analyzes technical SEO, and compares against benchmarks.',
              },
              {
                step: '03',
                title: 'Get Actionable Report',
                description: 'Receive a detailed audit with scores, gaps, and prioritized recommendations.',
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
                  {item.step}
                </div>
                <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
                <p className="text-slate-400">{item.description}</p>
                {i < 2 && (
                  <div className="absolute -right-4 top-8 hidden h-0.5 w-8 bg-slate-700 md:block" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 p-8 text-center shadow-lg sm:p-12">
            <h2 className="mb-4 text-3xl font-bold text-slate-900 sm:text-4xl">
              Ready to Outrank Your Competitors?
            </h2>
            <p className="mb-8 text-lg text-slate-600">
              Start your free audit today. No credit card required. Get insights in under 2 minutes.
            </p>
            <Link
              href={LOGIN_URL}
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:shadow-xl"
            >
              <Shield className="mr-2 h-5 w-5" />
              Start Free Audit Now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                <Search className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">RankedCEO</span>
            </div>
            <p className="text-sm text-slate-600">
              © {new Date().getFullYear()} RankedCEO. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}