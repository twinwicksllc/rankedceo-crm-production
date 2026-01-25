import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactForm } from '@/components/forms/contact-form'

export default async function NewContactPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('id', user.id)
    .single()

  if (!userData) redirect('/login')

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Add New Contact</CardTitle>
            <CardDescription>
              Create a new contact in your CRM
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm 
              accountId={userData.account_id} 
              userId={user.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}