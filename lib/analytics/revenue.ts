// Revenue Analytics
import { createClient } from '@/lib/supabase/server'
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns'

export interface RevenueByMonth {
  month: string
  revenue: number
}

export interface RevenueByUser {
  userId: string
  userName: string
  revenue: number
}

export interface RevenueTrend {
  currentPeriod: number
  previousPeriod: number
  growthRate: number
}

/**
 * Calculate total revenue from won deals
 */
export async function getTotalRevenue(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from('deals')
    .select('value')
    .eq('account_id', accountId)
    .eq('stage', 'Won')

  if (startDate) {
    query = query.gte('closed_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('closed_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Revenue Analytics] Error fetching total revenue:', error)
    return 0
  }

  return data?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0
}

/**
 * Get revenue by month for charts
 */
export async function getRevenueByMonth(
  accountId: string,
  months: number = 6
): Promise<RevenueByMonth[]> {
  const supabase = await createClient()
  const results: RevenueByMonth[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i))
    const monthEnd = endOfMonth(subMonths(new Date(), i))

    const { data, error } = await supabase
      .from('deals')
      .select('value')
      .eq('account_id', accountId)
      .eq('stage', 'Won')
      .gte('closed_at', monthStart.toISOString())
      .lte('closed_at', monthEnd.toISOString())

    if (error) {
      console.error('[Revenue Analytics] Error fetching revenue by month:', error)
      continue
    }

    const revenue = data?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0

    results.push({
      month: format(monthStart, 'MMM yyyy'),
      revenue,
    })
  }

  return results
}

/**
 * Get revenue by sales rep
 */
export async function getRevenueByUser(
  accountId: string
): Promise<RevenueByUser[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('deals')
    .select(`
      value,
      user_id,
      user:users!inner(name)
    `)
    .eq('account_id', accountId)
    .eq('stage', 'Won')

  if (error) {
    console.error('[Revenue Analytics] Error fetching revenue by user:', error)
    return []
  }

  const revenueByUser = new Map<string, { userName: string; revenue: number }>()

  data?.forEach((deal: any) => {
    const userId = deal.user_id
    const userName = deal.user?.name || 'Unknown'
    const value = deal.value || 0

    const existing = revenueByUser.get(userId) || { userName, revenue: 0 }
    revenueByUser.set(userId, {
      userName,
      revenue: existing.revenue + value,
    })
  })

  return Array.from(revenueByUser.entries()).map(([userId, { userName, revenue }]) => ({
    userId,
    userName,
    revenue,
  }))
}

/**
 * Get average deal size
 */
export async function getAverageDealSize(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from('deals')
    .select('value')
    .eq('account_id', accountId)
    .eq('stage', 'Won')

  if (startDate) {
    query = query.gte('closed_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('closed_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Revenue Analytics] Error fetching average deal size:', error)
    return 0
  }

  const deals = data || []
  if (deals.length === 0) return 0

  const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0)
  return totalValue / deals.length
}

/**
 * Get revenue trend (growth rate)
 */
export async function getRevenueTrend(
  accountId: string
): Promise<RevenueTrend> {
  const currentPeriodStart = startOfMonth(new Date())
  const currentPeriodEnd = endOfMonth(new Date())

  const previousPeriodStart = startOfMonth(subMonths(new Date(), 1))
  const previousPeriodEnd = endOfMonth(subMonths(new Date(), 1))

  const [currentRevenue, previousRevenue] = await Promise.all([
    getTotalRevenue(accountId, currentPeriodStart, currentPeriodEnd),
    getTotalRevenue(accountId, previousPeriodStart, previousPeriodEnd),
  ])

  let growthRate = 0
  if (previousRevenue > 0) {
    growthRate = ((currentRevenue - previousRevenue) / previousRevenue) * 100
  }

  return {
    currentPeriod: currentRevenue,
    previousPeriod: previousRevenue,
    growthRate,
  }
}