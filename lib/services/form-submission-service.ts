import { createClient } from '@/lib/supabase/client'
import { FormSubmission, SubmitFormInput } from '@/lib/types/form'
import { FormValidationService } from './form-validation-service'
import { FormService } from './form-service'

export class FormSubmissionService {
  private supabase: any
  private formService: FormService

  constructor() {
    this.supabase = createClient()
    this.formService = new FormService()
  }

  /**
   * Submit a form
   */
  async submitForm(
    submissionData: SubmitFormInput,
    ipAddress?: string,
    userAgent?: string,
    referrer?: string
  ): Promise<FormSubmission> {
    // Get form with fields
    const form = await this.formService.getFormById(submissionData.form_id)
    
    if (!form) {
      throw new Error('Form not found')
    }

    if (form.status !== 'published') {
      throw new Error('Form is not published')
    }

    // Check if multiple submissions are allowed
    if (!form.allow_multiple_submissions && ipAddress) {
      const existingSubmission = await this.checkExistingSubmission(
        submissionData.form_id,
        ipAddress
      )
      
      if (existingSubmission) {
        throw new Error('You have already submitted this form')
      }
    }

    // Validate submission data
    const validation = FormValidationService.validateFormData(
      form.fields,
      submissionData.submission_data
    )

    if (!validation.valid) {
      throw new Error(JSON.stringify(validation.errors))
    }

    // Sanitize data
    const sanitizedData = FormValidationService.sanitizeFormData(
      submissionData.submission_data
    )

    // Create submission
    const { data, error } = await this.supabase
      .from('form_submissions')
      .insert({
        form_id: submissionData.form_id,
        submission_data: sanitizedData,
        ip_address: ipAddress,
        user_agent: userAgent,
        referrer: referrer,
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating submission:', error)
      throw error
    }

    // Try to match to existing contact
    if (form.collect_email) {
      const email = this.extractEmail(sanitizedData)
      if (email) {
        await this.linkToContact(data.id, email, form.account_id)
      }
    }

    // Send notification if enabled
    if (form.send_notification_email && form.notification_emails) {
      await this.sendNotification(form, data)
    }

    return data
  }

  /**
   * Check if user has already submitted
   */
  private async checkExistingSubmission(
    formId: string,
    ipAddress: string
  ): Promise<FormSubmission | null> {
    const { data } = await this.supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .eq('ip_address', ipAddress)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .single()

    return data
  }

  /**
   * Extract email from submission data
   */
  private extractEmail(data: Record<string, any>): string | null {
    // Look for common email field names
    const emailFields = ['email', 'email_address', 'contact_email', 'user_email']
    
    for (const field of emailFields) {
      if (data[field] && typeof data[field] === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (emailRegex.test(data[field])) {
          return data[field]
        }
      }
    }

    return null
  }

  /**
   * Link submission to contact
   */
  private async linkToContact(
    submissionId: string,
    email: string,
    accountId: string
  ): Promise<void> {
    // Try to find contact by email
    const { data: contact } = await this.supabase
      .from('contacts')
      .select('id')
      .eq('account_id', accountId)
      .eq('email', email)
      .single()

    if (contact) {
      await this.supabase
        .from('form_submissions')
        .update({ contact_id: contact.id })
        .eq('id', submissionId)
    }
  }

  /**
   * Send notification email
   */
  private async sendNotification(
    form: any,
    submission: FormSubmission
  ): Promise<void> {
    // This would integrate with SendGrid to send notification
    // For now, just log it
    console.log('Form notification would be sent to:', form.notification_emails)
    console.log('Submission ID:', submission.id)
    console.log('Submission Data:', submission.submission_data)
  }

  /**
   * Get submissions for export
   */
  async getSubmissionsForExport(formId: string): Promise<FormSubmission[]> {
    const { data, error } = await this.supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching submissions for export:', error)
      throw error
    }

    return data || []
  }

  /**
   * Export submissions to CSV
   */
  async exportToCSV(formId: string): Promise<string> {
    const submissions = await this.getSubmissionsForExport(formId)
    const form = await this.formService.getFormById(formId)

    if (!form || submissions.length === 0) {
      return ''
    }

    // Get all field keys from the form
    const fieldKeys = form.fields.map(f => f.field_key)

    // Create CSV header
    const headers = ['Submission ID', 'Submitted At', ...fieldKeys]
    const headerRow = headers.join(',')

    // Create CSV rows
    const rows = submissions.map(submission => {
      const values = [
        submission.id,
        submission.submitted_at,
        ...fieldKeys.map(key => {
          const value = submission.submission_data[key] || ''
          // Escape commas and quotes
          const escaped = String(value).replace(/"/g, '""')
          return `"${escaped}"`
        }),
      ]
      return values.join(',')
    })

    return [headerRow, ...rows].join('\n')
  }

  /**
   * Export submissions to JSON
   */
  async exportToJSON(formId: string): Promise<string> {
    const submissions = await this.getSubmissionsForExport(formId)
    return JSON.stringify(submissions, null, 2)
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStats(formId: string): Promise<{
    total: number
    today: number
    thisWeek: number
    thisMonth: number
  }> {
    const { data: submissions } = await this.supabase
      .from('form_submissions')
      .select('submitted_at')
      .eq('form_id', formId)

    if (!submissions || submissions.length === 0) {
      return { total: 0, today: 0, thisWeek: 0, thisMonth: 0 }
    }

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const stats = {
      total: submissions.length,
      today: 0,
      thisWeek: 0,
      thisMonth: 0,
    }

    for (const submission of submissions) {
      const date = new Date(submission.submitted_at)
      if (date >= today) stats.today++
      if (date >= weekAgo) stats.thisWeek++
      if (date >= monthAgo) stats.thisMonth++
    }

    return stats
  }
}
