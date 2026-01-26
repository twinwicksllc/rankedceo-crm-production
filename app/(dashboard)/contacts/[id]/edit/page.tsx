import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ContactForm } from '@/components/forms/contact-form'

export default async function EditContactPage({
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
    .eq('email', user.email)
    .single()

  if (!userData) redirect('/login')

  // Get contact
  const { data: contact } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', params.id)
    .eq('account_id', userData.account_id)
    .single()

  if (!contact) notFound()

  return (
    <div className="p-8">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Edit Contact</CardTitle>
            <CardDescription>
              Update contact information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ContactForm 
              contact={contact}
              accountId={userData.account_id} 
              userId={user.id}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}