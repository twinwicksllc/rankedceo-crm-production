import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SmileDashboard from './smile-dashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get assessment count for this user
  const { count } = await supabase
    .from('smile_assessments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  return <SmileDashboard userId={user.id} assessmentCount={count || 0} />
}
