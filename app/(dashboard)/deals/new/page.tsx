import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DealForm from '@/components/forms/deal-form'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function NewDealPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's account
  const { data: profile } = await supabase
    .from('profiles')
    .select('account_id')
    .eq('id', user.id)
    .single()

  if (!profile?.account_id) {
    return <div>No account found</div>
  }

  // Fetch contacts for dropdown
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('account_id', profile.account_id)
    .order('first_name')

  // Fetch companies for dropdown
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('account_id', profile.account_id)
    .order('name')

  // Fetch pipelines for dropdown
  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('account_id', profile.account_id)
    .order('name')

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/deals">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Deal</h1>
          <p className="text-muted-foreground mt-1">
            Create a new sales opportunity
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6">
        <DealForm 
          accountId={profile.account_id}
          contacts={contacts || []}
          companies={companies || []}
          pipelines={pipelines || []}
        />
      </Card>
    </div>
  )
}
