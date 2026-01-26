'use client'

import { useState, useEffect } from 'react'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DollarSign, Target, TrendingUp, Clock } from 'lucide-react'
import { formatCurrency, formatPercentage } from '@/lib/utils'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

interface PipelineDashboardProps {
  accountId: string
}

export function PipelineDashboard({ accountId }: PipelineDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [pipelineByStage, setPipelineByStage] = useState<any[]>([])
  const [winRate, setWinRate] = useState(0)
  const [averageDealCycle, setAverageDealCycle] = useState(0)
  const [dealsBySource, setDealsBySource] = useState<any[]>([])
  const [totalPipelineValue, setTotalPipelineValue] = useState(0)

  useEffect(() => {
    fetchPipelineData()
  }, [accountId])

  const fetchPipelineData = async () => {
    setLoading(true)
    try {
      const [stageRes, winRateRes, cycleRes, sourceRes] = await Promise.all([
        fetch(`/api/analytics/pipeline/by-stage?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/pipeline/win-rate?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/pipeline/avg-deal-cycle?accountId=${accountId}`).then(r => r.json()),
        fetch(`/api/analytics/pipeline/by-source?accountId=${accountId}`).then(r => r.json()),
      ])

      setPipelineByStage(stageRes.data || [])
      setWinRate(winRateRes.winRate || 0)
      setAverageDealCycle(cycleRes.avgDealCycle || 0)
      setDealsBySource(sourceRes.data || [])
      
      const totalValue = (stageRes.data || []).reduce((sum: number, stage: any) => sum + stage.value, 0)
      setTotalPipelineValue(totalValue)
    } catch (error) {
      console.error('[Pipeline Dashboard] Error fetching data:', error)
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
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPipelineValue)}</div>
            <p className="text-xs text-muted-foreground">Open deals</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercentage(winRate)}</div>
            <p className="text-xs text-muted-foreground">Won vs Lost</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deal Cycle</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageDealCycle)} days</div>
            <p className="text-xs text-muted-foreground">Time to close</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Deals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pipelineByStage.reduce((sum: number, stage: any) => sum + stage.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">In pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Funnel</CardTitle>
          <CardDescription>Deal distribution by stage</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={pipelineByStage} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
              <YAxis dataKey="stage" type="category" width={100} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  'Pipeline Value'
                ]}
              />
              <Legend />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Deals by Source Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Deals by Source</CardTitle>
          <CardDescription>Where your leads are coming from</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={dealsBySource}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {dealsBySource.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [formatCurrency(value), 'Value']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pipeline Stage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Stage Details</CardTitle>
          <CardDescription>Detailed breakdown by stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {pipelineByStage.map((stage: any, index: number) => (
              <div key={stage.stage} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="text-sm text-muted-foreground">
                      {stage.count} deals
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${(stage.value / totalPipelineValue) * 100}%`,
                        backgroundColor: COLORS[index % COLORS.length]
                      }}
                    />
                  </div>
                </div>
                <div className="ml-4 text-right">
                  <div className="text-lg font-bold">{formatCurrency(stage.value)}</div>
                  <div className="text-xs text-muted-foreground">
                    {((stage.value / totalPipelineValue) * 100).toFixed(1)}% of pipeline
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}