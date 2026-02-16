'use client'

export const dynamic = 'force-dynamic'
export const revalidate = 0

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Users, Target, TrendingUp, Clock, AlertCircle } from 'lucide-react'

// Sample data for Patient Qualification
const patientQualificationData = [
  { month: 'Jan', qualified: 12, unqualified: 8, consultation: 5 },
  { month: 'Feb', qualified: 15, unqualified: 6, consultation: 7 },
  { month: 'Mar', qualified: 18, unqualified: 5, consultation: 9 },
  { month: 'Apr', qualified: 22, unqualified: 4, consultation: 11 },
  { month: 'May', qualified: 25, unqualified: 3, consultation: 13 },
  { month: 'Jun', qualified: 28, unqualified: 2, consultation: 15 },
]

// Case Mix Revenue Targets
const caseMixData = [
  {
    name: 'Teaser',
    price: 1999,
    description: 'Basic Smile Assessment',
    color: '#E9D5FF', // Light purple
    percentage: 15,
  },
  {
    name: 'Full Composite',
    price: 3999,
    description: 'Complete Smile Makeover',
    color: '#C4B5FD', // Medium purple
    percentage: 35,
  },
  {
    name: 'Porcelain',
    price: 15600,
    description: 'Premium Porcelain Veneers',
    color: '#8B5CF6', // Deep purple
    percentage: 50,
  },
]

// AI Employee Activity Feed
const aiActivityFeed = [
  {
    id: 1,
    action: 'Patient Follow-up',
    patient: 'Sarah Mitchell',
    timestamp: '2 hours ago',
    status: 'completed',
    type: 'reminder',
  },
  {
    id: 2,
    action: 'Case Recommendation',
    patient: 'John Davis',
    timestamp: '1 hour ago',
    status: 'pending',
    type: 'recommendation',
  },
  {
    id: 3,
    action: 'Appointment Confirmed',
    patient: 'Emma Wilson',
    timestamp: '30 mins ago',
    status: 'completed',
    type: 'confirmation',
  },
  {
    id: 4,
    action: 'Payment Reminder',
    patient: 'Michael Chen',
    timestamp: 'Just now',
    status: 'pending',
    type: 'payment',
  },
]

// Qualification metrics
const qualificationMetrics = [
  {
    label: 'This Month',
    value: 28,
    subtext: 'Qualified Patients',
    icon: Users,
    color: 'bg-purple-100 text-purple-700',
  },
  {
    label: 'Qualification Rate',
    value: '88%',
    subtext: 'vs. 75% last month',
    icon: Target,
    color: 'bg-purple-50 text-purple-600',
  },
  {
    label: 'Avg Case Value',
    value: '$6,866',
    subtext: 'Based on mix',
    icon: TrendingUp,
    color: 'bg-purple-100 text-purple-700',
  },
  {
    label: 'Pending Consults',
    value: 15,
    subtext: 'Awaiting follow-up',
    icon: Clock,
    color: 'bg-purple-50 text-purple-600',
  },
]

export default function SmilePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-25">
      {/* Header */}
      <div className="border-b border-purple-200 bg-white bg-opacity-80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 to-purple-700">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Smile MakeOver</h1>
                <p className="text-sm text-purple-600 font-medium">Dentist Dashboard</p>
              </div>
            </div>
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">
              Premium Plan
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Metrics */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {qualificationMetrics.map((metric) => {
            const Icon = metric.icon
            return (
              <Card key={metric.label} className="border-purple-100 bg-white hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm font-medium text-gray-600">
                    {metric.label}
                    <div className={`rounded-lg p-2 ${metric.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                  <p className="text-xs text-gray-500 mt-1">{metric.subtext}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Patient Qualification Trend - Large Chart */}
          <Card className="border-purple-100 lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                Patient Qualification Trend
              </CardTitle>
              <CardDescription>
                Monthly qualified patients vs. consultations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={patientQualificationData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E9D5FF" />
                  <XAxis dataKey="month" stroke="#6B7280" />
                  <YAxis stroke="#6B7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FFF',
                      border: '1px solid #E9D5FF',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="qualified"
                    stroke="#8B5CF6"
                    strokeWidth={3}
                    dot={{ fill: '#8B5CF6', r: 5 }}
                    name="Qualified"
                  />
                  <Line
                    type="monotone"
                    dataKey="consultation"
                    stroke="#C4B5FD"
                    strokeWidth={2}
                    dot={{ fill: '#C4B5FD', r: 4 }}
                    name="In Consultation"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Case Mix Distribution */}
          <Card className="border-purple-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                Case Mix Distribution
              </CardTitle>
              <CardDescription>Revenue targets by case type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={caseMixData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} ${percentage}%`}
                    outerRadius={80}
                    fill="#8B5CF6"
                    dataKey="percentage"
                  >
                    {caseMixData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Case Mix Details */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {caseMixData.map((caseType) => (
            <Card
              key={caseType.name}
              className={`border-2 transition-all hover:shadow-lg`}
              style={{ borderColor: caseType.color }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{caseType.name}</CardTitle>
                  <Badge
                    className="text-xs font-semibold"
                    style={{
                      backgroundColor: caseType.color,
                      color: '#6B21A8',
                    }}
                  >
                    {caseType.percentage}%
                  </Badge>
                </div>
                <CardDescription className="text-sm">
                  {caseType.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-3xl font-bold text-gray-900">
                    ${caseType.price.toLocaleString()}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="rounded-full h-2 transition-all"
                      style={{
                        backgroundColor: caseType.color,
                        width: `${caseType.percentage}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 pt-2">
                    Target: {caseType.percentage}% of revenue mix
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* AI Employee Activity Feed */}
        <Card className="mt-8 border-purple-100">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI Employee Activity Feed
            </CardTitle>
            <CardDescription>
              Automated patient management and follow-ups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {aiActivityFeed.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-4 rounded-lg border border-purple-100 bg-purple-50 p-4"
                >
                  <div className="mt-1">
                    {activity.type === 'reminder' && (
                      <Clock className="h-5 w-5 text-purple-600" />
                    )}
                    {activity.type === 'recommendation' && (
                      <AlertCircle className="h-5 w-5 text-purple-600" />
                    )}
                    {activity.type === 'confirmation' && (
                      <Sparkles className="h-5 w-5 text-purple-600" />
                    )}
                    {activity.type === 'payment' && (
                      <TrendingUp className="h-5 w-5 text-purple-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">
                        {activity.action}
                      </p>
                      <Badge
                        variant="outline"
                        className={
                          activity.status === 'completed'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                        }
                      >
                        {activity.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{activity.patient}</p>
                    <p className="text-xs text-gray-500 mt-1">{activity.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-8 rounded-lg bg-gradient-to-r from-purple-50 to-white border border-purple-200 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Welcome to Smile MakeOver
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                This dashboard is designed to help you track patient qualifications and manage your case mix revenue targets. 
                Your AI Employee is continuously working to optimize patient follow-ups and increase conversion rates.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
