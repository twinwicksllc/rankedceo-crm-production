import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Mail, Phone, Briefcase, Linkedin, Edit, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  // Get contact with relations
  const { data: contact } = await supabase
    .from('contacts')
    .select(`
      *,
      company:companies(id, name, industry),
      owner:users(id, full_name)
    `)
    .eq('id', params.id)
    .eq('account_id', userData.account_id)
    .single()

  if (!contact) notFound()

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" asChild>
            <Link href="/contacts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">
              {contact.first_name} {contact.last_name}
            </h1>
            {contact.job_title && (
              <p className="text-gray-600 mt-1">{contact.job_title}</p>
            )}
          </div>
          <Button asChild>
            <Link href={`/contacts/${contact.id}/edit`}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Contact Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {contact.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Email</p>
                      <a href={`mailto:${contact.email}`} className="text-primary hover:underline">
                        {contact.email}
                      </a>
                    </div>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <a href={`tel:${contact.phone}`} className="text-primary hover:underline">
                        {contact.phone}
                      </a>
                    </div>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">Company</p>
                      <Link href={`/companies/${contact.company.id}`} className="text-primary hover:underline">
                        {contact.company.name}
                      </Link>
                    </div>
                  </div>
                )}
                {contact.linkedin_url && (
                  <div className="flex items-center gap-3">
                    <Linkedin className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">LinkedIn</p>
                      <a 
                        href={contact.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        View Profile
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {contact.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Lead Score</CardTitle>
              </CardHeader>
              <CardContent>
                {contact.lead_score !== null ? (
                  <div className="text-center">
                    <div className="text-5xl font-bold text-primary mb-2">
                      {contact.lead_score}
                    </div>
                    <Badge
                      variant={
                        contact.lead_score >= 70
                          ? 'default'
                          : contact.lead_score >= 40
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {contact.lead_score >= 70 ? 'Hot Lead' : contact.lead_score >= 40 ? 'Warm Lead' : 'Cold Lead'}
                    </Badge>
                  </div>
                ) : (
                  <p className="text-center text-gray-600">No score yet</p>
                )}
              </CardContent>
            </Card>

            {contact.tags && contact.tags.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag: string) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-600">Owner</p>
                  <p className="font-medium">{contact.owner?.full_name || 'Unassigned'}</p>
                </div>
                <div>
                  <p className="text-gray-600">Created</p>
                  <p className="font-medium">
                    {new Date(contact.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Last Updated</p>
                  <p className="font-medium">
                    {new Date(contact.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}