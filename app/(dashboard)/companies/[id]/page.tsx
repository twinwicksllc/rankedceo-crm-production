import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Edit, Globe, Phone, MapPin, Building2, Users } from 'lucide-react'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
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

  // Fetch company with contacts
  const { data: company, error } = await supabase
    .from('companies')
    .select(`
      *,
      contacts (
        id,
        first_name,
        last_name,
        email,
        job_title,
        phone
      )
    `)
    .eq('id', params.id)
    .eq('account_id', profile.account_id)
    .single()

  if (error || !company) {
    notFound()
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/companies">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{company.name}</h1>
            <p className="text-muted-foreground mt-1">
              Company Details
            </p>
          </div>
        </div>
        <Link href={`/companies/${company.id}/edit`}>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </Link>
      </div>

      {/* Company Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Company Information</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Status</p>
              <Badge variant={company.status === 'active' ? 'default' : 'secondary'}>
                {company.status || 'active'}
              </Badge>
            </div>

            {company.website && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Website</p>
                <a 
                  href={company.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Globe className="h-4 w-4" />
                  {company.website}
                </a>
              </div>
            )}

            {company.phone && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <a 
                  href={`tel:${company.phone}`}
                  className="flex items-center gap-2 hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {company.phone}
                </a>
              </div>
            )}

            {company.industry && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Industry</p>
                <p className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {company.industry}
                </p>
              </div>
            )}

            {company.company_size && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Company Size</p>
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {company.company_size} employees
                </p>
              </div>
            )}

            {(company.address || company.city || company.state || company.country) && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Address</p>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1" />
                  <div>
                    {company.address && <p>{company.address}</p>}
                    <p>
                      {[company.city, company.state, company.postal_code]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                    {company.country && <p>{company.country}</p>}
                  </div>
                </div>
              </div>
            )}

            {company.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{company.notes}</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Contacts</h2>
            <Link href={`/contacts/new?company_id=${company.id}`}>
              <Button size="sm">Add Contact</Button>
            </Link>
          </div>

          {!company.contacts || company.contacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No contacts yet</p>
              <Link href={`/contacts/new?company_id=${company.id}`}>
                <Button size="sm">Add First Contact</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {company.contacts.map((contact: any) => (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </p>
                      {contact.job_title && (
                        <p className="text-sm text-muted-foreground">
                          {contact.job_title}
                        </p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-muted-foreground">
                          {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-muted-foreground">
                          {contact.phone}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
