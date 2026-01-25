import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, DollarSign, Calendar, TrendingUp, Building2, User } from 'lucide-react'

export default async function DealDetailPage({ params }: { params: { id: string } }) {
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

  // Fetch deal with related data
  const { data: deal, error } = await supabase
    .from('deals')
    .select(`
      *,
      contact:contacts(id, first_name, last_name, email, phone),
      company:companies(id, name, website),
      pipeline:pipelines(id, name)
    `)
    .eq('id', params.id)
    .eq('account_id', profile.account_id)
    .single()

  if (error || !deal) {
    notFound()
  }

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
        <div className="flex items-center gap-4">
          <Link href="/deals">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{deal.name}</h1>
            <p className="text-muted-foreground mt-1">
              Deal Details
            </p>
          </div>
        </div>
        <Link href={`/deals/${deal.id}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Deal Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Deal Information</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Stage</p>
              <Badge className={getStageColor(deal.stage)}>
                {deal.stage}
              </Badge>
            </div>

            {deal.value && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Deal Value</p>
                <p className="flex items-center gap-2 text-2xl font-bold">
                  <DollarSign className="h-6 w-6" />
                  ${deal.value.toLocaleString()}
                </p>
              </div>
            )}

            {deal.probability !== null && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Probability</p>
                <p className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {deal.probability}%
                </p>
              </div>
            )}

            {deal.expected_close_date && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Expected Close Date</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {new Date(deal.expected_close_date).toLocaleDateString()}
                </p>
              </div>
            )}

            {deal.pipeline && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pipeline</p>
                <p>{deal.pipeline.name}</p>
              </div>
            )}

            {deal.description && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{deal.description}</p>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          {/* Contact Info */}
          {deal.contact && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Contact</h2>
              <Link 
                href={`/contacts/${deal.contact.id}`}
                className="block hover:bg-muted/50 p-4 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 mt-1" />
                  <div>
                    <p className="font-medium">
                      {deal.contact.first_name} {deal.contact.last_name}
                    </p>
                    {deal.contact.email && (
                      <p className="text-sm text-muted-foreground">
                        {deal.contact.email}
                      </p>
                    )}
                    {deal.contact.phone && (
                      <p className="text-sm text-muted-foreground">
                        {deal.contact.phone}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </Card>
          )}

          {/* Company Info */}
          {deal.company && (
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Company</h2>
              <Link 
                href={`/companies/${deal.company.id}`}
                className="block hover:bg-muted/50 p-4 rounded-lg transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 mt-1" />
                  <div>
                    <p className="font-medium">{deal.company.name}</p>
                    {deal.company.website && (
                      <p className="text-sm text-muted-foreground">
                        {deal.company.website}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
