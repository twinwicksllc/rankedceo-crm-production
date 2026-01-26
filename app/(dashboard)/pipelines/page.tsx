import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Plus, Workflow } from 'lucide-react'

export default async function PipelinesPage() {
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

  // Fetch pipelines with deal count
  const { data: pipelines, error } = await supabase
    .from('pipelines')
    .select(`
      *,
      deals:deals(count)
    `)
    .eq('account_id', userData.account_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching pipelines:', error)
    return <div>Error loading pipelines</div>
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pipelines</h1>
          <p className="text-muted-foreground mt-1">
            Manage your sales pipelines and stages
          </p>
        </div>
        <Link href="/pipelines/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Pipeline
          </Button>
        </Link>
      </div>

      {/* Pipelines List */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">All Pipelines</h2>
          
          {!pipelines || pipelines.length === 0 ? (
            <div className="text-center py-12">
              <Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pipelines yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first pipeline to organize deals
              </p>
              <Link href="/pipelines/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pipeline
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {pipelines.map((pipeline) => (
                <Card key={pipeline.id} className="p-6 hover:shadow-lg transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{pipeline.name}</h3>
                      {pipeline.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {pipeline.description}
                        </p>
                      )}
                    </div>
                    <Workflow className="h-5 w-5 text-muted-foreground" />
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {pipeline.deals?.[0]?.count || 0} deals
                    </p>
                    
                    <div className="flex gap-2">
                      <Link href={`/pipelines/${pipeline.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          View
                        </Button>
                      </Link>
                      <Link href={`/pipelines/${pipeline.id}/edit`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          Edit
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
