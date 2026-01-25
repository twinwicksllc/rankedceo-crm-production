import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PipelineForm from '@/components/forms/pipeline-form'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export default async function NewPipelinePage() {
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

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/pipelines">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Add New Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Create a new sales pipeline
          </p>
        </div>
      </div>

      {/* Form */}
      <Card className="p-6">
        <PipelineForm accountId={profile.account_id} />
      </Card>
    </div>
  )
}
