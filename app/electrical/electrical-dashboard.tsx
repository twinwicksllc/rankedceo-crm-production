'use client'

import { useState, useEffect, useCallback } from 'react'
import { Lightbulb, Copy, Check, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DashboardStats } from '@/components/industry/dashboard-stats'
import { LeadCard } from '@/components/industry/lead-card'
import { LeadFiltersBar } from '@/components/industry/lead-filters'
import { getIndustryLeads, getIndustryLeadStats } from '@/lib/actions/industry-lead'
import type { IndustryLead, LeadStats, LeadFilters, LeadStatus } from '@/lib/types/industry-lead'
import { IndustryLogo } from '@/components/ui/industry-logo'

interface ElectricalDashboardProps {
  userId: string
  leadCount: number
}

export default function ElectricalDashboard({ userId, leadCount }: ElectricalDashboardProps) {
  const [leads, setLeads] = useState<IndustryLead[]>([])
  const [stats, setStats] = useState<LeadStats | null>(null)
  const [filters, setFilters] = useState<LeadFilters>({ industry: 'electrical' })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const leadLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/lead?operatorId=${userId}`
      : `https://electrical.rankedceo.com/lead?operatorId=${userId}`

  const loadData = useCallback(async () => {
    setLoading(true)
    const [leadsResult, statsResult] = await Promise.all([
      getIndustryLeads('electrical', filters),
      getIndustryLeadStats('electrical'),
    ])
    if (leadsResult.success) setLeads(leadsResult.data)
    if (statsResult.success && statsResult.data) setStats(statsResult.data)
    setLoading(false)
  }, [filters])

  useEffect(() => { loadData() }, [loadData])

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(leadLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStatusChange = (leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))
    getIndustryLeadStats('electrical').then(r => { if (r.success && r.data) setStats(r.data) })
  }

  const emergencyLeads = leads.filter(l => l.urgency === 'emergency' && l.status === 'new')
  const otherLeads = leads.filter(l => !(l.urgency === 'emergency' && l.status === 'new'))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-amber-200 bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IndustryLogo industry="electrical" height={48} priority />
              <p className="text-sm text-gray-500">Operator Dashboard</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}
              className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        {stats && <DashboardStats stats={stats} industry="electrical" />}

        {/* Lead Link */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-900">Your Lead Capture Link</p>
              <p className="text-xs text-amber-700 mt-0.5">Share this link with customers to capture leads directly to your dashboard</p>
            </div>
            <div className="flex items-center gap-2">
              <code className="rounded bg-white border border-amber-200 px-3 py-1.5 text-xs text-amber-800 truncate max-w-[240px]">
                {leadLink}
              </code>
              <Button size="sm" onClick={handleCopyLink} className="bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        {/* Emergency Leads */}
        {emergencyLeads.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="text-sm font-bold text-red-800 mb-3">
              🚨 {emergencyLeads.length} Electrical Emergency{emergencyLeads.length > 1 ? 's' : ''} — Safety Issue Reported
            </p>
            <div className="space-y-3">
              {emergencyLeads.map(lead => (
                <LeadCard key={lead.id} lead={lead} industry="electrical" onStatusChange={handleStatusChange} />
              ))}
            </div>
          </div>
        )}

        {/* Leads List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              All Leads {leads.length > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({leads.length})</span>}
            </h2>
            <Button size="sm" variant="outline" onClick={() => window.open('/lead', '_blank')}
              className="border-amber-200 text-amber-700 hover:bg-amber-50">
              <Plus className="mr-1 h-4 w-4" />New Lead Form
            </Button>
          </div>

          <LeadFiltersBar industry="electrical" filters={filters} onChange={setFilters} />

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-lg bg-gray-100 animate-pulse" />)}
            </div>
          ) : otherLeads.length === 0 && emergencyLeads.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center">
              <Lightbulb className="mx-auto h-10 w-10 text-amber-300 mb-3" />
              <p className="text-gray-500 font-medium">No leads yet</p>
              <p className="text-sm text-gray-400 mt-1">Share your lead link to start capturing electrical service requests</p>
              <Button className="mt-4 bg-amber-600 hover:bg-amber-700" onClick={handleCopyLink}>
                <Copy className="mr-2 h-4 w-4" />Copy Lead Link
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {otherLeads.map(lead => (
                <LeadCard key={lead.id} lead={lead} industry="electrical" onStatusChange={handleStatusChange} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}