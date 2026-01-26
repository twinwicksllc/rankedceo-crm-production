'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

interface ActivityDashboardProps {
  accountId: string
  dateRange?: { start: Date; end: Date }
}

export function ActivityDashboard({ accountId, dateRange }: ActivityDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [activityByType, setActivityByType] = useState<any[]>([])
  const [completionRate, setCompletionRate] = useState(0)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    overdue: 0,
  })

  useEffect(() => {
    fetchActivityData()
  }, [accountId, dateRange])

  const fetchActivityData = async () => {
    setLoading(true)
    try {
      const [typeRes, rateRes, leaderboardRes, statsRes] = await Promise.all([
        fetch(`/api/analytics/activity/by-type?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/activity/completion-rate?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/activity/leaderboard?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/activity/stats?accountId=${accountId}`).then(r => r.json()),
      ])

      setActivityByType(typeRes.data || [])
      setCompletionRate(rateRes.completionRate || 0)
      setLeaderboard(leaderboardRes.data || [])
      setStats(statsRes || { total: 0, completed: 0, pending: 0, overdue: 0 })
    } catch (error) {
      console.error('[Activity Dashboard] Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All activities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">
              {completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <p className="text-xs text-muted-foreground">Need attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity by Type Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Activity by Type</CardTitle>
          <CardDescription>Distribution of activity types</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activityByType}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="type" />
              <YAxis />
              <Tooltip formatter={(value: number) => [value, 'Count']} />
              <Legend />
              <Bar dataKey="count" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Activity Leaderboard</CardTitle>
          <CardDescription>Most active team members</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {leaderboard.slice(0, 10).map((user: any, index: number) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{user.userName}</div>
                    <div className="text-sm text-muted-foreground">
                      {user.activityCount} activities
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{user.activityCount}</div>
                  <div className="text-xs text-muted-foreground">activities</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Completion Rate Progress */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate</CardTitle>
          <CardDescription>Overall activity completion percentage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-5xl font-bold text-primary">
                {completionRate.toFixed(1)}%
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                of {stats.total} activities completed
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-4">
              <div
                className="bg-primary h-4 rounded-full transition-all"
                style={{ width: `${completionRate}%` }}
              />
            </div>
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">{stats.completed}</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-500">{stats.overdue}</div>
                <div className="text-xs text-muted-foreground">Overdue</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}