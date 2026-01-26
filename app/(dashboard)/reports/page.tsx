import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RevenueDashboard } from '@/components/analytics/revenue-dashboard'
import { PipelineDashboard } from '@/components/analytics/pipeline-dashboard'
import { ActivityDashboard } from '@/components/analytics/activity-dashboard'

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('email', user.email)
    .single()

  if (!userData) {
    redirect('/login')
  }

  const accountId = userData.account_id

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive analytics and insights for your business
        </p>
      </div>

      <RevenueDashboard accountId={accountId} />
    </div>
  )
}
