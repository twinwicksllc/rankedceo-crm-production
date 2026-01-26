import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import DealForm from '@/components/forms/deal-form'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function EditDealPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's account
  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('email', user.email)
    .single()

  if (!userData?.account_id) {
    return <div>No account found</div>
  }

  // Fetch deal
  const { data: deal, error } = await supabase
    .from('deals')
    .select('*')
    .eq('id', params.id)
    .eq('account_id', userData.account_id)
    .single()

  if (error || !deal) {
    notFound()
  }

  // Fetch contacts for dropdown
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, last_name')
    .eq('account_id', userData.account_id)
    .order('first_name')

  // Fetch companies for dropdown
  const { data: companies } = await supabase
    .from('companies')
    .select('id, name')
    .eq('account_id', userData.account_id)
    .order('name')

  // Fetch pipelines for dropdown
  const { data: pipelines } = await supabase
    .from('pipelines')
    .select('id, name')
    .eq('account_id', userData.account_id)
    .order('name')

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/deals/${deal.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Deal</h1>
          <p className="text-muted-foreground mt-1">
            Update {deal.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6">
        <DealForm 
          accountId={userData.account_id}
          contacts={contacts || []}
          companies={companies || []}
          pipelines={pipelines || []}
          deal={deal}
        />
      </Card>
    </div>
  )
}
