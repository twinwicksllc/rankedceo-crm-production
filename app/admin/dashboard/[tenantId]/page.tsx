import { buildAuditReportPath } from '@/lib/waas/utils/audit-report-url'
// =============================================================================
// AdvantagePoint — Tenant Detail View (Server Component)
// Brand Sheet, Audit Results, Domain Requests, Deploy Site, Live Preview
// =============================================================================

import React          from 'react'
import Link           from 'next/link'
import { notFound }   from 'next/navigation'
import { ensureClientReviewToken, getTenantDetail } from '@/lib/waas/actions/admin'
import { DeploySiteButton }    from './deploy-site-button'
import { DomainStatusManager } from './domain-status-manager'
import { PreviewTab }          from './preview-tab'
import { VersionRollbackButton } from './version-rollback-button'
import type { WaasDomainRequest } from '@/lib/waas/types'

interface PageProps {
  params:      { tenantId: string }
  searchParams: { tab?: string }
}

export default async function TenantDetailPage({ params, searchParams }: PageProps) {
  const result = await getTenantDetail(params.tenantId)
  if (!result.success || !result.data) notFound()

  const { tenant, domainRequests, audit, versions } = result.data
  const siteConfig = result.data.siteConfig
  const brand   = tenant.brand_config
  const colors  = brand?.colors
  const activeTab = searchParams?.tab ?? 'overview'
  const tokenResult = await ensureClientReviewToken(tenant.id)
  const reviewToken = tokenResult.data ?? tenant.id

  return (
    <div>
      {/* Back */}
      <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-white/40 hover:text-white/70 text-sm mb-6 transition-colors">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${colors?.primary ?? '#2563EB'}, ${colors?.secondary ?? '#1E40AF'})` }}
        >
          {(brand?.business_name ?? tenant.legal_name ?? '?')[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {brand?.business_name ?? tenant.legal_name ?? 'Unnamed Business'}
          </h1>
          <p className="text-white/40 text-sm mt-0.5">
            {tenant.primary_trade ?? '—'} &bull; {tenant.city ? `${tenant.city}, ${tenant.state}` : '—'} &bull; {tenant.package_tier} plan
          </p>
        </div>
        {/* Deploy Site */}
        {(tenant.status === 'pending_review' || tenant.status === 'onboarding') && (
          <DeploySiteButton
            tenantId={tenant.id}
            businessName={brand?.business_name ?? tenant.legal_name ?? 'this business'}
          />
        )}
        {tenant.status === 'active' && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-sm font-semibold">Live</span>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-8 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {[
          { key: 'overview', label: '📋 Overview' },
          { key: 'preview',  label: '🌐 Live Preview' },
        ].map(tab => (
          <Link
            key={tab.key}
            href={`/admin/dashboard/${params.tenantId}?tab=${tab.key}`}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white/10 text-white shadow-sm'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Brand Sheet + Contact */}
          <div className="lg:col-span-1 space-y-6">

            {/* Brand Sheet */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-white font-semibold text-sm">Brand Sheet</h2>
              </div>
              <div className="p-5 space-y-5">
                {/* Logo */}
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Logo</p>
                  {brand?.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.logo_url} alt="Logo" className="max-h-12 max-w-full object-contain" />
                  ) : (
                    <div
                      className="h-10 w-28 rounded-lg flex items-center justify-center text-white text-sm font-bold"
                      style={{ background: `linear-gradient(135deg, ${colors?.primary ?? '#2563EB'}, ${colors?.secondary ?? '#1E40AF'})` }}
                    >
                      {(brand?.business_name ?? '')[0]}
                    </div>
                  )}
                </div>

                {/* Colors */}
                <div>
                  <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Color Palette</p>
                  <div className="flex gap-2">
                    {colors && Object.entries(colors).map(([key, val]) => val ? (
                      <div key={key} className="group relative">
                        <div
                          className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer"
                          style={{ backgroundColor: val as string }}
                          title={`${key}: ${val}`}
                        />
                      </div>
                    ) : null)}
                  </div>
                  <div className="mt-2 flex gap-3 flex-wrap">
                    <div>
                      <p className="text-white/25 text-[10px]">PRIMARY</p>
                      <p className="text-white font-mono text-xs">{colors?.primary ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-white/25 text-[10px]">SECONDARY</p>
                      <p className="text-white font-mono text-xs">{colors?.secondary ?? '—'}</p>
                    </div>
                  </div>
                </div>

                {/* USP */}
                {tenant.usp && (
                  <div>
                    <p className="text-white/40 text-xs uppercase tracking-wider mb-2">Unique Selling Proposition</p>
                    <p className="text-white/70 text-sm leading-relaxed">{tenant.usp}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Details */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-white font-semibold text-sm">Contact Details</h2>
              </div>
              <div className="p-5 space-y-3">
                {[
                  { label: 'Email',    value: tenant.submitted_by_email },
                  { label: 'Address',  value: tenant.physical_address },
                  { label: 'City',     value: tenant.city && tenant.state ? `${tenant.city}, ${tenant.state} ${tenant.zip ?? ''}` : null },
                  { label: 'Trade',    value: tenant.primary_trade },
                  { label: 'Calendly', value: tenant.calendly_url },
                  { label: 'Financing',value: tenant.financing_enabled ? 'Enabled' : 'Disabled' },
                ].map(row => row.value ? (
                  <div key={row.label} className="flex gap-3">
                    <span className="text-white/30 text-xs w-16 shrink-0 pt-0.5">{row.label}</span>
                    <span className="text-white/70 text-xs break-all">{row.value}</span>
                  </div>
                ) : null)}
              </div>
            </div>
          </div>

          {/* Right column: Domains + Audit */}
          <div className="lg:col-span-2 space-y-6">

            {/* Domain Requests */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h2 className="text-white font-semibold text-sm">Domain Requests</h2>
              </div>
              <div className="p-5">
                {domainRequests.length === 0 ? (
                  <p className="text-white/30 text-sm">No domain requests submitted.</p>
                ) : (
                  <div className="space-y-3">
                    {domainRequests.map((req: WaasDomainRequest) => (
                      <DomainStatusManager key={req.id} request={req} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Audit Results */}
            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">Original Audit</h2>
                {audit && (
                  <Link
                    href={buildAuditReportPath((audit as { id: string }).id, {
                      requestorCompany: (audit as { requestor_company?: string | null }).requestor_company ?? null,
                      requestorName: (audit as { requestor_name?: string | null }).requestor_name ?? null,
                      targetUrl: (audit as { target_url?: string | null }).target_url ?? null,
                    })}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium transition-colors"
                    target="_blank"
                  >
                    View Full Report →
                  </Link>
                )}
              </div>
              <div className="p-5">
                {!audit ? (
                  <p className="text-white/30 text-sm">No linked audit report.</p>
                ) : (
                  <AuditSummaryCard audit={audit} />
                )}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="text-white font-semibold text-sm">Client Review Status</h2>
                <a
                  href={`/review/${reviewToken}`}
                  className="text-cyan-300 hover:text-cyan-200 text-xs font-medium transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Review ↗
                </a>
              </div>
              <div className="p-5 text-sm">
                {siteConfig?.client_selected_template_slug ? (
                  <div className="space-y-2">
                    <p className="text-emerald-300 font-semibold">Client has selected a direction.</p>
                    <p className="text-white/70 text-xs">
                      Template: {siteConfig.client_selected_template_slug}
                      {siteConfig.client_selected_at ? ` • ${new Date(siteConfig.client_selected_at).toLocaleString()}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="text-white/50 text-xs">Waiting for client selection.</p>
                )}

                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="text-white/50 text-[11px] uppercase tracking-wide mb-3">Recent Version History</p>
                  {versions.length === 0 ? (
                    <p className="text-white/40 text-xs">No snapshots yet. They will appear as templates and feedback change.</p>
                  ) : (
                    <div className="space-y-2">
                      {versions.map((version) => (
                        <div key={version.id} className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                          <div>
                            <p className="text-white/80 text-xs font-medium">
                              {version.template_slug ? `Template: ${version.template_slug}` : 'Template snapshot'}
                            </p>
                            <p className="text-white/45 text-[11px]">
                              {version.change_source.replace(/_/g, ' ')}
                              {version.summary ? ` • ${version.summary}` : ''}
                            </p>
                            <p className="text-white/35 text-[10px] mt-0.5">
                              {new Date(version.created_at).toLocaleString()}
                            </p>
                          </div>
                          <VersionRollbackButton tenantId={tenant.id} versionId={version.id} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Live Preview */}
      {activeTab === 'preview' && (
        <PreviewTab
          tenantId={tenant.id}
          slug={tenant.slug}
          currentTheme={siteConfig?.site_templates?.slug ?? null}
          reviewToken={reviewToken}
          clientSelectedTemplate={siteConfig?.client_selected_template_slug ?? null}
          clientSelectedAt={siteConfig?.client_selected_at ?? null}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Audit Summary Card
// ---------------------------------------------------------------------------

function AuditSummaryCard({ audit }: { audit: Record<string, unknown> }) {
  const report  = audit.report_data as Record<string, unknown> | null
  const summary = report?.summary as Record<string, number> | null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Overall', value: summary?.overall_score   },
          { label: 'SEO',     value: summary?.seo_score       },
          { label: 'Perf.',   value: summary?.performance_score },
          { label: 'Mobile',  value: summary?.mobile_score    },
        ].map(m => (
          <div key={m.label} className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
            <div className={`text-2xl font-bold ${
              (m.value ?? 0) >= 70 ? 'text-emerald-400' :
              (m.value ?? 0) >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {m.value !== undefined ? m.value : '—'}
            </div>
            <div className="text-white/40 text-xs mt-0.5">{m.label}</div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 text-sm">
        <div>
          <span className="text-white/30 text-xs">Target URL</span>
          <p className="text-white/60 text-xs truncate max-w-[250px]">{String(audit.target_url ?? '—')}</p>
        </div>
        <div>
          <span className="text-white/30 text-xs">Status</span>
          <p className="text-white/60 text-xs capitalize">{String(audit.status ?? '—')}</p>
        </div>
      </div>
    </div>
  )
}