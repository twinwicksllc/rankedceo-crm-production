// Pipeline Analytics
import { createClient } from '@/lib/supabase/server'

export interface PipelineValueByStage {
  stage: string
  count: number
  value: number
}

export interface DealsBySource {
  source: string
  count: number
  value: number
}

export interface PipelineVelocity {
  stage: string
  avgDays: number
}

/**
 * Get total pipeline value by stage
 */
export async function getPipelineValueByStage(
  accountId: string
): Promise<PipelineValueByStage[]> {
  const supabase = await createClient()

  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']
  const results: PipelineValueByStage[] = []

  for (const stage of stages) {
    const { data, error } = await supabase
      .from('deals')
      .select('value')
      .eq('account_id', accountId)
      .eq('stage', stage)
      .not('stage', 'eq', 'Lost')

    if (error) {
      console.error('[Pipeline Analytics] Error fetching pipeline by stage:', error)
      continue
    }

    const value = data?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0

    results.push({
      stage,
      count: data?.length || 0,
      value,
    })
  }

  return results
}

/**
 * Calculate win rate
 */
export async function getWinRate(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from('deals')
    .select('stage, closed_at')
    .eq('account_id', accountId)
    .in('stage', ['Won', 'Lost'])

  if (startDate) {
    query = query.gte('closed_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('closed_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Pipeline Analytics] Error fetching win rate:', error)
    return 0
  }

  const deals = data || []
  if (deals.length === 0) return 0

  const wonDeals = deals.filter((deal) => deal.stage === 'Won').length
  return (wonDeals / deals.length) * 100
}

/**
 * Get average deal cycle time
 */
export async function getAverageDealCycle(
  accountId: string
): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('created_at, closed_at')
    .eq('account_id', accountId)
    .eq('stage', 'Won')
    .not('closed_at', 'is', null)

  if (error) {
    console.error('[Pipeline Analytics] Error fetching deal cycle:', error)
    return 0
  }

  const deals = data || []
  if (deals.length === 0) return 0

  const totalDays = deals.reduce((sum, deal) => {
    if (!deal.closed_at) return sum
    const created = new Date(deal.created_at).getTime()
    const closed = new Date(deal.closed_at).getTime()
    const days = Math.ceil((closed - created) / (1000 * 60 * 60 * 24))
    return sum + days
  }, 0)

  return totalDays / deals.length
}

/**
 * Get deals by source
 */
export async function getDealsBySource(
  accountId: string
): Promise<DealsBySource[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select('source, value')
    .eq('account_id', accountId)

  if (error) {
    console.error('[Pipeline Analytics] Error fetching deals by source:', error)
    return []
  }

  const dealsBySource = new Map<string, { count: number; value: number }>()

  data?.forEach((deal) => {
    const source = deal.source || 'Unknown'
    const value = deal.value || 0

    const existing = dealsBySource.get(source) || { count: 0, value: 0 }
    dealsBySource.set(source, {
      count: existing.count + 1,
      value: existing.value + value,
    })
  })

  return Array.from(dealsBySource.entries()).map(([source, { count, value }]) => ({
    source,
    count,
    value,
  }))
}

/**
 * Get pipeline velocity (days between stages)
 * Note: This is a simplified version. For accurate tracking, you'd need
 * a deal_stage_history table to record when deals move between stages.
 */
export async function getPipelineVelocity(
  accountId: string
): Promise<PipelineVelocity[]> {
  const supabase = await createClient()

  // For now, we'll estimate velocity based on average deal cycle
  const avgDealCycle = await getAverageDealCycle(accountId)
  const stages = ['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won']

  // Distribute avg deal cycle across stages
  const avgDaysPerStage = avgDealCycle / stages.length

  return stages.map((stage) => ({
    stage,
    avgDays: Math.round(avgDaysPerStage),
  }))
}