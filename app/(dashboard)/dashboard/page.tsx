import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Building2, DollarSign, Activity } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get user and account info
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-yellow-800">Not Authenticated</h2>
          <p className="text-yellow-700 mt-2">Please log in to access the dashboard.</p>
        </div>
      </div>
    )
  }

  // Get user's account_id by email (matching RLS policy)
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('account_id, name')
    .eq('email', user.email)
    .single()

  // Check onboarding status
  if (userData) {
    const { data: accountData } = await supabase
      .from('accounts')
      .select('onboarding_completed')
      .eq('id', userData.account_id)
      .single()

    // Redirect to onboarding if not completed
    if (accountData && !accountData.onboarding_completed) {
      const { redirect } = await import('next/navigation')
      redirect('/onboarding')
    }
  }

  if (!userData) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800">Account Setup Required</h2>
          <p className="text-red-700 mt-2">
            Your user account is not fully set up. This usually means the database migration needs to be run.
          </p>
          <div className="mt-4 p-4 bg-white rounded border text-sm">
            <p><strong>Debug Info:</strong></p>
            <p>Auth Email: {user.email}</p>
            <p>Auth ID: {user.id}</p>
            <p>Error: {userError?.message || 'No user record found'}</p>
          </div>
          <div className="mt-4 text-sm text-red-600">
            <p><strong>Solution:</strong> Run the user migration in Supabase SQL Editor:</p>
            <code className="block mt-2 p-2 bg-gray-100 rounded text-xs">
              supabase/migrations/000007_correct_link_auth_users.sql
            </code>
          </div>
        </div>
      </div>
    )
  }

  // Get stats
  const { count: contactsCount } = await supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', userData.account_id)

  const { count: companiesCount } = await supabase
    .from('companies')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', userData.account_id)

  const { count: dealsCount } = await supabase
    .from('deals')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', userData.account_id)

  const { count: activitiesCount } = await supabase
    .from('activities')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', userData.account_id)

  const stats = [
    {
      name: 'Total Contacts',
      value: contactsCount || 0,
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Total Companies',
      value: companiesCount || 0,
      icon: Building2,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Active Deals',
      value: dealsCount || 0,
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Activities',
      value: activitiesCount || 0,
      icon: Activity,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {userData.name || 'User'}!
        </h1>
        <p className="text-gray-600 mt-2">
          Here's what's happening with your business today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.name}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <a
              href="/contacts/new"
              className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Add New Contact</div>
              <div className="text-sm text-gray-600">Create a new contact in your CRM</div>
            </a>
            <a
              href="/deals/new"
              className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Create Deal</div>
              <div className="text-sm text-gray-600">Start tracking a new opportunity</div>
            </a>
            <a
              href="/campaigns/new"
              className="block p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              <div className="font-medium">Launch Campaign</div>
              <div className="text-sm text-gray-600">Create an email campaign</div>
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Set up your CRM for success</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="h-2 w-2 rounded-full bg-green-600"></div>
              <div className="flex-1">
                <div className="font-medium text-green-900">Account Created</div>
                <div className="text-sm text-green-700">Your account is ready to use</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <div className="h-2 w-2 rounded-full bg-gray-300"></div>
              <div className="flex-1">
                <div className="font-medium">Import Contacts</div>
                <div className="text-sm text-gray-600">Upload your existing contacts</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200">
              <div className="h-2 w-2 rounded-full bg-gray-300"></div>
              <div className="flex-1">
                <div className="font-medium">Configure Email</div>
                <div className="text-sm text-gray-600">Set up email integration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}