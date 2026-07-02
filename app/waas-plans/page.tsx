// =============================================================================
// app/waas-plans/page.tsx
// Phase 8.1 — WaaS Public Pricing / Marketing Page
//
// Public-facing landing page for the RankedCEO Website-as-a-Service product.
// Explains what WaaS is, shows the 4-tier pricing table, and drives traffic
// to the audit funnel (/get-started).
//
// No auth required. Statically rendered (no dynamic data).
// =============================================================================

import type { Metadata } from "next";
import Link from "next/link";
import { PricingTable } from "@/components/waas/marketing/PricingTable";

export const metadata: Metadata = {
  title: "AI-Built Websites for Local Businesses | RankedCEO",
  description:
    "RankedCEO builds, hosts, and ranks your website using AI — starting free. Get a custom-designed site live in 48 hours with built-in SEO audits, competitor tracking, and more.",
  openGraph: {
    title: "AI-Built Websites for Local Businesses | RankedCEO",
    description:
      "RankedCEO builds, hosts, and ranks your website using AI — starting free. Get a custom-designed site live in 48 hours.",
    type: "website",
    url: "https://rankedceo.com/waas-plans",
  },
};

// ---------------------------------------------------------------------------
// Hero section (server component — no interactivity needed)
// ---------------------------------------------------------------------------

function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-800 text-white pt-24 pb-28 px-4 sm:px-6 lg:px-8">
      {/* Decorative background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-700/20 blur-3xl" />
        <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl" />
        <div className="absolute bottom-0 left-1/2 w-[800px] h-48 -translate-x-1/2 bg-blue-600/10 blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto text-center">
        {/* Pre-headline badge */}
        <div className="inline-flex items-center gap-2 mb-6 text-xs font-semibold tracking-widest uppercase text-blue-400 bg-blue-900/40 border border-blue-700/40 px-4 py-2 rounded-full">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
          Website-as-a-Service · Built with AI
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight mb-6">
          Your business website,{" "}
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            built and ranked by AI
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          RankedCEO generates a custom, fully-hosted website for your local
          business in 48 hours — then continuously audits and improves it so you
          rank higher on Google.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/get-started"
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-blue-500/30 transition-all"
          >
            Get your free audit
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 text-white font-semibold px-8 py-4 rounded-xl border border-white/10 transition-all"
          >
            See pricing
          </a>
        </div>

        {/* Social proof bar */}
        <div className="mt-14 flex flex-wrap justify-center gap-8 text-sm text-slate-400">
          {[
            { stat: "48h", label: "Average launch time" },
            { stat: "AI-built", label: "Unique site designs" },
            { stat: "4 plans", label: "Starting free" },
            { stat: "100%", label: "Managed hosting" },
          ].map(({ stat, label }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <span className="text-2xl font-extrabold text-white">{stat}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// How it works (3-step explainer)
// ---------------------------------------------------------------------------

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Run your free AI audit",
      body: "Enter your website URL (or just your business name). Our AI scores your site on SEO, performance, and mobile — and identifies your biggest growth opportunities.",
      icon: "🔍",
    },
    {
      num: "02",
      title: "We build your site in 48 hours",
      body: "Our AI generates a custom, professionally-designed website tailored to your industry, service area, and brand. You review and approve before anything goes live.",
      icon: "⚡",
    },
    {
      num: "03",
      title: "We manage, host, and rank it",
      body: "Your site is hosted on our lightning-fast infrastructure. Monthly SEO audits track your Google rankings, surface competitor gaps, and guide your next moves.",
      icon: "📈",
    },
  ];

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3">
            From audit to live site — in three steps
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            No design skills needed. No dev team needed. Just answer a few
            questions and we handle the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map(({ num, title, body, icon }) => (
            <div
              key={num}
              className="relative bg-white rounded-2xl p-8 shadow-sm border border-slate-100"
            >
              <div className="absolute -top-4 left-6 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                Step {num}
              </div>
              <div className="text-4xl mb-4 mt-2">{icon}</div>
              <h3 className="font-bold text-slate-800 text-lg mb-2">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Industries we serve
// ---------------------------------------------------------------------------

function Industries() {
  const industries = [
    { icon: "🔧", label: "Plumbing" },
    { icon: "❄️", label: "HVAC" },
    { icon: "⚡", label: "Electrical" },
    { icon: "🏡", label: "Real Estate" },
    { icon: "🦷", label: "Dental / Medical" },
    { icon: "🌿", label: "Landscaping" },
    { icon: "🔑", label: "Property Management" },
    { icon: "🚗", label: "Auto Services" },
  ];

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-8">
          Built for local service businesses
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {industries.map(({ icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-4 py-2 text-sm font-medium text-slate-700"
            >
              <span>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// FAQ section
// ---------------------------------------------------------------------------

const FAQS = [
  {
    q: "Do I need to provide any content or design assets?",
    a: "No. Our AI generates all copy, layout, and design based on your business information. You can optionally upload a logo and photos, but they're not required to get started.",
  },
  {
    q: "What happens to my current website?",
    a: "Nothing changes until you're ready. We build your new site in parallel, and you choose when (or if) to switch over. We help with the domain transfer when you're ready.",
  },
  {
    q: "Can I edit the site myself after it launches?",
    a: "Yes — every plan includes access to our client editor where you can update text, images, and toggle sections. Premium plans include AI-assisted rewrites.",
  },
  {
    q: "How does annual billing work for the Hosting Only plan?",
    a: "The Hosting Only plan is billed once per year at $199. You'll receive a renewal reminder 30 days before it expires and can cancel anytime before renewal.",
  },
  {
    q: "Can I upgrade or downgrade my plan later?",
    a: "Absolutely. You can upgrade or downgrade from within your client portal at any time. Upgrades take effect immediately; downgrades apply at the next billing cycle.",
  },
  {
    q: "What's the difference between the Hosting and Hosting Only plans?",
    a: "The free Hosting plan is included for all active RankedCEO clients as part of our WaaS service — no separate charge. The Hosting Only plan ($199/yr) is for clients who want standalone hosting without the audit and AI tools.",
  },
];

function FAQ() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-slate-900 mb-3">
            Frequently asked questions
          </h2>
          <p className="text-slate-500">
            Still have questions?{" "}
            <Link href="/get-started" className="text-blue-600 hover:underline">
              Run a free audit
            </Link>{" "}
            and we&apos;ll walk you through the right plan.
          </p>
        </div>
        <div className="space-y-4">
          {FAQS.map(({ q, a }) => (
            <div
              key={q}
              className="bg-white rounded-xl border border-slate-200 p-6"
            >
              <p className="font-semibold text-slate-800 mb-2">{q}</p>
              <p className="text-sm text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function WaasPlansPage() {
  return (
    <main className="min-h-screen bg-white">
      <HeroSection />
      <HowItWorks />
      <Industries />
      <div id="pricing">
        <PricingTable />
      </div>
      <FAQ />
    </main>
  );
}
