import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Plus, Users, DollarSign } from 'lucide-react'

export default async function CompaniesPage() {
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

  // Fetch companies with contact count
  const { data: companies, error } = await supabase
    .from('companies')
    .select(`
      *,
      contacts:contacts(count)
    `)
    .eq('account_id', userData.account_id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching companies:', error)
    return <div>Error loading companies</div>
  }

  return (
    <div className="space-y-6 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Companies</h1>
          <p className="text-muted-foreground mt-1">
            Manage your company accounts and relationships
          </p>
        </div>
        <Link href="/companies/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Companies</p>
              <p className="text-2xl font-bold">{companies?.length || 0}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Contacts</p>
              <p className="text-2xl font-bold">
                {companies?.reduce((sum, c) => sum + (c.contacts?.[0]?.count || 0), 0) || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Accounts</p>
              <p className="text-2xl font-bold">
                {companies?.filter(c => c.status === 'active').length || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Companies List */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">All Companies</h2>
          
          {!companies || companies.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No companies yet</h3>
              <p className="text-muted-foreground mb-4">
                Get started by adding your first company
              </p>
              <Link href="/companies/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Company
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-semibold">Company</th>
                    <th className="text-left py-3 px-4 font-semibold">Industry</th>
                    <th className="text-left py-3 px-4 font-semibold">Size</th>
                    <th className="text-left py-3 px-4 font-semibold">Contacts</th>
                    <th className="text-left py-3 px-4 font-semibold">Status</th>
                    <th className="text-left py-3 px-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {companies.map((company) => (
                    <tr key={company.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div>
                          <Link 
                            href={`/companies/${company.id}`}
                            className="font-medium hover:underline"
                          >
                            {company.name}
                          </Link>
                          {company.website && (
                            <p className="text-sm text-muted-foreground">
                              {company.website}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {company.industry || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {company.company_size || '-'}
                      </td>
                      <td className="py-3 px-4">
                        {company.contacts?.[0]?.count || 0}
                      </td>
                      <td className="py-3 px-4">
                        <Badge 
                          variant={company.status === 'active' ? 'default' : 'secondary'}
                        >
                          {company.status || 'active'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Link href={`/companies/${company.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                          <Link href={`/companies/${company.id}/edit`}>
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
