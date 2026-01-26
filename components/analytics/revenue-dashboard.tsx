'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
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
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface RevenueDashboardProps {
  accountId: string
  dateRange?: { start: Date; end: Date }
}

export function RevenueDashboard({ accountId, dateRange }: RevenueDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [revenueByMonth, setRevenueByMonth] = useState<any[]>([])
  const [revenueByUser, setRevenueByUser] = useState<any[]>([])
  const [averageDealSize, setAverageDealSize] = useState(0)
  const [trend, setTrend] = useState<{ growthRate: number } | null>(null)

  useEffect(() => {
    fetchRevenueData()
  }, [accountId, dateRange])

  const fetchRevenueData = async () => {
    setLoading(true)
    try {
      const [
        totalRes,
        monthlyRes,
        userRes,
        avgDealRes,
        trendRes,
      ] = await Promise.all([
        fetch(`/api/analytics/revenue/total?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/revenue/by-month?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/revenue/by-user?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/revenue/average-deal-size?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/revenue/trend?accountId=${accountId}`).then(r => r.json()),
      ])

      setTotalRevenue(totalRes.totalRevenue || 0)
      setRevenueByMonth(monthlyRes.data || [])
      setRevenueByUser(userRes.data || [])
      setAverageDealSize(avgDealRes.averageDealSize || 0)
      setTrend(trendRes)
    } catch (error) {
      console.error('[Revenue Dashboard] Error fetching data:', error)
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
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalRevenue)}</div>
            {trend && (
              <div className="flex items-center text-xs text-muted-foreground mt-1">
                {trend.growthRate >= 0 ? (
                  <>
                    <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                    <span className="text-green-500">+{trend.growthRate.toFixed(1)}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                    <span className="text-red-500">{trend.growthRate.toFixed(1)}%</span>
                  </>
                )}
                <span className="ml-1">from last month</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Size</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(averageDealSize)}</div>
            <p className="text-xs text-muted-foreground">Per won deal</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Trend</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenueByMonth.length > 0
                ? formatCurrency(revenueByMonth[revenueByMonth.length - 1].revenue)
                : '$0'}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {revenueByUser.length > 0 ? revenueByUser[0].userName : 'N/A'}
            </div>
            <p className="text-xs text-muted-foreground">
              {revenueByUser.length > 0 ? formatCurrency(revenueByUser[0].revenue) : '$0'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Revenue over the last 6 months</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue by User Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue by Sales Rep</CardTitle>
          <CardDescription>Total revenue per team member</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByUser}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="userName" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'Revenue']}
              />
              <Legend />
              <Bar dataKey="revenue" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}