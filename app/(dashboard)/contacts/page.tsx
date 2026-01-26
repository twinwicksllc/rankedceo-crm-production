import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Mail, TrendingUp, Plus } from 'lucide-react'
import Link from 'next/link'

export default async function ContactsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('id', user.id)
    .single()

  if (!userData) return null

  // Get contacts with company info
  const { data: contacts } = await supabase
    .from('contacts')
    .select(`
      *,
      company:companies(id, name),
      owner:users(id, name)
    `)
    .eq('account_id', userData.account_id)
    .order('created_at', { ascending: false })

  // Calculate stats
  const totalContacts = contacts?.length || 0
  const withEmail = contacts?.filter(c => c.email).length || 0
  const highScore = contacts?.filter(c => (c.lead_score || 0) >= 70).length || 0
  const avgScore = contacts?.length 
    ? Math.round(contacts.reduce((sum, c) => sum + (c.lead_score || 0), 0) / contacts.length)
    : 0

  const stats = [
    { name: 'Total Contacts', value: totalContacts, icon: Users, color: 'text-blue-600' },
    { name: 'With Email', value: withEmail, icon: Mail, color: 'text-green-600' },
    { name: 'High Score (70+)', value: highScore, icon: TrendingUp, color: 'text-purple-600' },
    { name: 'Avg Lead Score', value: avgScore, icon: TrendingUp, color: 'text-orange-600' },
  ]

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
          <p className="text-gray-600 mt-2">Manage your contacts and leads</p>
        </div>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.name}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>All Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts && contacts.length > 0 ? (
            <div className="space-y-4">
              {contacts.map((contact) => (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {contact.first_name[0]}{contact.last_name[0]}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">
                            {contact.first_name} {contact.last_name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            {contact.email && (
                              <span className="text-sm text-gray-600">{contact.email}</span>
                            )}
                            {contact.phone && (
                              <span className="text-sm text-gray-600">• {contact.phone}</span>
                            )}
                          </div>
                          {contact.company && (
                            <p className="text-sm text-gray-500 mt-1">
                              {contact.company.name}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {contact.lead_score !== null && (
                        <Badge
                          variant={
                            contact.lead_score >= 70
                              ? 'default'
                              : contact.lead_score >= 40
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          Score: {contact.lead_score}
                        </Badge>
                      )}
                      {contact.tags && contact.tags.length > 0 && (
                        <Badge variant="outline">{contact.tags[0]}</Badge>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
              <p className="text-gray-600 mb-4">Get started by adding your first contact</p>
              <Button asChild>
                <Link href="/contacts/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Contact
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}