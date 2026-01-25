import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import CompanyForm from '@/components/forms/company-form'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function EditCompanyPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get user's account
  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('id', user.id)
    .single()

  if (!userData?.account_id) {
    return <div>No account found</div>
  }

  // Fetch company
  const { data: company, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', params.id)
    .eq('account_id', userData.account_id)
    .single()

  if (error || !company) {
    notFound()
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/companies/${company.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Company</h1>
          <p className="text-muted-foreground mt-1">
            Update {company.name}
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6">
        <CompanyForm accountId={userData.account_id} company={company} />
      </Card>
    </div>
  )
}
