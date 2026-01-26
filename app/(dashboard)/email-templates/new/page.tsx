import { redirect } from 'next/navigation'
import { CampaignService } from '@/lib/services/campaign-service'
import { EmailTemplateForm } from '@/components/forms/email-template-form'

export default async function NewEmailTemplatePage() {
  async function createTemplate(formData: FormData) {
    'use server'
    
    const campaignService = new CampaignService()

    try {
      const variablesValue = formData.get('variables')
      const variables = variablesValue ? JSON.parse(variablesValue.toString()) : []

      const template = await campaignService.createTemplate({
        name: formData.get('name') as string,
        subject: formData.get('subject') as string,
        body: formData.get('html_content') as string,
        variables: variables,
      })

      redirect(`/email-templates/${template.id}`)
    } catch (error) {
      console.error('Error creating email template:', error)
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">New Email Template</h1>
        <p className="text-gray-500">Create a reusable email template for your campaigns</p>
      </div>

      <EmailTemplateForm 
        action={createTemplate}
        submitLabel="Create Template"
      />
    </div>
  )
}
