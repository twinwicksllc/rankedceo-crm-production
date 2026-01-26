// Activity Analytics
import { createClient } from '@/lib/supabase/server'
import { startOfDay, endOfDay, subDays } from 'date-fns'

export interface ActivityByType {
  type: string
  count: number
}

export interface ActivityLeaderboard {
  userId: string
  userName: string
  activityCount: number
}

/**
 * Get activity count by type
 */
export async function getActivityByType(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ActivityByType[]> {
  const supabase = await createClient()

  let query = supabase
    .from('activities')
    .select('type')
    .eq('account_id', accountId)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Activity Analytics] Error fetching activity by type:', error)
    return []
  }

  const activityByType = new Map<string, number>()

  data?.forEach((activity) => {
    const type = activity.type || 'Other'
    activityByType.set(type, (activityByType.get(type) || 0) + 1)
  })

  return Array.from(activityByType.entries()).map(([type, count]) => ({
    type,
    count,
  }))
}

/**
 * Get activity completion rate
 */
export async function getActivityCompletionRate(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<number> {
  const supabase = await createClient()

  let query = supabase
    .from('activities')
    .select('status')
    .eq('account_id', accountId)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Activity Analytics] Error fetching completion rate:', error)
    return 0
  }

  const activities = data || []
  if (activities.length === 0) return 0

  const completedActivities = activities.filter(
    (activity) => activity.status === 'completed'
  ).length

  return (completedActivities / activities.length) * 100
}

/**
 * Get user activity leaderboard
 */
export async function getActivityLeaderboard(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<ActivityLeaderboard[]> {
  const supabase = await createClient()

  let query = supabase
    .from('activities')
    .select(`
      user_id,
      user:users!inner(name)
    `)
    .eq('account_id', accountId)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Activity Analytics] Error fetching leaderboard:', error)
    return []
  }

  const activityByUser = new Map<string, { userName: string; count: number }>()

  data?.forEach((activity: any) => {
    const userId = activity.user_id
    const userName = activity.user?.name || 'Unknown'

    const existing = activityByUser.get(userId) || { userName, count: 0 }
    activityByUser.set(userId, {
      userName,
      count: existing.count + 1,
    })
  })

  return Array.from(activityByUser.entries())
    .map(([userId, { userName, count }]) => ({
      userId,
      userName,
      activityCount: count,
    }))
    .sort((a, b) => b.activityCount - a.activityCount)
}

/**
 * Get upcoming activities
 */
export async function getUpcomingActivities(
  accountId: string,
  days: number = 7
): Promise<any[]> {
  const supabase = await createClient()

  const startDate = startOfDay(new Date())
  const endDate = endOfDay(subDays(new Date(), -days))

  const { data, error } = await supabase
    .from('activities')
    .select(`
      *,
      contact:contacts(name),
      company:companies(name)
    `)
    .eq('account_id', accountId)
    .gte('due_date', startDate.toISOString())
    .lte('due_date', endDate.toISOString())
    .in('status', ['pending', 'in_progress'])
    .order('due_date', { ascending: true })
    .limit(10)

  if (error) {
    console.error('[Activity Analytics] Error fetching upcoming activities:', error)
    return []
  }

  return data || []
}

/**
 * Get activity summary statistics
 */
export async function getActivityStats(
  accountId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  total: number
  completed: number
  pending: number
  overdue: number
}> {
  const supabase = await createClient()

  let query = supabase
    .from('activities')
    .select('status, due_date')
    .eq('account_id', accountId)

  if (startDate) {
    query = query.gte('created_at', startDate.toISOString())
  }
  if (endDate) {
    query = query.lte('created_at', endDate.toISOString())
  }

  const { data, error } = await query

  if (error) {
    console.error('[Activity Analytics] Error fetching activity stats:', error)
    return { total: 0, completed: 0, pending: 0, overdue: 0 }
  }

  const activities = data || []
  const now = new Date()

  const total = activities.length
  const completed = activities.filter((a) => a.status === 'completed').length
  const pending = activities.filter(
    (a) => a.status === 'pending' && new Date(a.due_date) > now
  ).length
  const overdue = activities.filter(
    (a) => a.status !== 'completed' && a.due_date && new Date(a.due_date) < now
  ).length

  return { total, completed, pending, overdue }
}