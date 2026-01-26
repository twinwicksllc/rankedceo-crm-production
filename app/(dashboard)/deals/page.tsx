import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Plus, TrendingUp, Clock, CheckCircle2 } from 'lucide-react'

export default async function DealsPage() {
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

  // Fetch deals with related data
  const { data: deals, error } = await supabase
    .from('deals')
    .select(`
      *,
      contact:contacts(first_name, last_name),
      company:companies(name),
      pipeline:pipelines(name)
    `)
    .eq('account_id', userData.account_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching deals:', error)
    return <div>Error loading deals</div>
  }

  // Calculate statistics
  const totalValue = deals?.reduce((sum, deal) => sum + (deal.value || 0), 0) || 0
  const wonDeals = deals?.filter(d => d.stage === 'won').length || 0
  const activeDeals = deals?.filter(d => !['won', 'lost'].includes(d.stage)).length || 0

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'lead': return 'bg-gray-100 text-gray-800'
      case 'qualified': return 'bg-blue-100 text-blue-800'
      case 'proposal': return 'bg-purple-100 text-purple-800'
      case 'negotiation': return 'bg-orange-100 text-orange-800'
      case 'won': return 'bg-green-100 text-green-800'
      case 'lost': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deals</h1>
          <p className="text-muted-foreground mt-1">
            Track and manage your sales opportunities
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/pipelines">
            <Button variant="outline">
              Manage Pipelines
            </Button>
          </Link>
          <Link href="/deals/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Deal
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold">
                ${totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Won Deals</p>
              <p className="text-2xl font-bold">{wonDeals}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Deals</p>
              <p className="text-2xl font-bold">{activeDeals}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-2xl font-bold">
                {deals && deals.length > 0 
                  ? Math.round((wonDeals / deals.length) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Deals List */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">All Deals</h2>
          
          {!deals || deals.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No deals yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by creating your first deal
              </p>
              <Link href="/deals/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Deal
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Deal Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Contact</th>
                    <th className="text-left py-3 px-4 font-semibold">Company</th>
                    <th className="text-left py-3 px-4 font-semibold">Value</th>
                    <th className="text-left py-3 px-4 font-semibold">Stage</th>
                    <th className="text-left py-3 px-4 font-semibold">Close Date</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deals.map((deal) => (
                    <tr key={deal.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <Link 
                          href={`/deals/${deal.id}`}
                          className="font-medium hover:underline"
                        >
                          {deal.name}
                        </Link>
                      </td>
                      <td className="py-3 px-4">
                        {deal.contact 
                          ? `${deal.contact.first_name} ${deal.contact.last_name}`
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {deal.company?.name || '-'}
                      </td>
                      <td className="py-3 px-4">
                        ${(deal.value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getStageColor(deal.stage)}>
                          {deal.stage}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        {deal.expected_close_date 
                          ? new Date(deal.expected_close_date).toLocaleDateString()
                          : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Link href={`/deals/${deal.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          <Link href={`/deals/${deal.id}/edit`}>
                            <Button variant="ghost" size="sm">
                              Edit
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
