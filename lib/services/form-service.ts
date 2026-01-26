import { createClient } from '@/lib/supabase/client'
import { 
  Form, 
  FormWithFields, 
  FormSubmission, 
  FormStats,
  CreateFormInput, 
  UpdateFormInput,
  FormFilters
} from '@/lib/types/form'

export class FormService {
  private supabase: any

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Get all forms with optional filters
   */
  async getForms(filters?: FormFilters): Promise<Form[]> {
    let query = this.supabase
      .from('forms')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching forms:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get form by ID with fields
   */
  async getFormById(id: string): Promise<FormWithFields | null> {
    const { data, error } = await this.supabase
      .from('forms')
      .select(`
        *,
        fields:form_fields(*)
      `)
      .eq('id', id)
      .order('fields.order_index', { ascending: true })
      .single()

    if (error) {
      console.error('Error fetching form:', error)
      return null
    }

    return data
  }

  /**
   * Get form by public URL (for public access)
   */
  async getFormByPublicUrl(publicUrl: string): Promise<FormWithFields | null> {
    const { data, error } = await this.supabase
      .from('forms')
      .select(`
        *,
        fields:form_fields(*)
      `)
      .eq('public_url', publicUrl)
      .eq('status', 'published')
      .order('fields.order_index', { ascending: true })
      .single()

    if (error) {
      console.error('Error fetching form by public URL:', error)
      return null
    }

    return data
  }

  /**
   * Create new form
   */
  async createForm(data: CreateFormInput, accountId: string): Promise<Form> {
    const { data: form, error } = await this.supabase
      .from('forms')
      .insert({ 
        ...data, 
        account_id: accountId,
        status: data.status || 'draft'
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating form:', error)
      throw error
    }

    return form
  }

  /**
   * Update form
   */
  async updateForm(id: string, data: UpdateFormInput): Promise<Form> {
    const { data: form, error } = await this.supabase
      .from('forms')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating form:', error)
      throw error
    }

    return form
  }

  /**
   * Delete form
   */
  async deleteForm(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('forms')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting form:', error)
      throw error
    }
  }

  /**
   * Get form statistics
   */
  async getFormStats(): Promise<FormStats> {
    const { data: forms } = await this.supabase
      .from('forms')
      .select('id, name, status')

    const stats: FormStats = {
      total_forms: 0,
      published_forms: 0,
      draft_forms: 0,
      total_submissions: 0,
      recent_submissions: 0,
      top_forms: [],
    }

    if (!forms) return stats

    stats.total_forms = forms.length
    stats.published_forms = forms.filter((f: any) => f.status === 'published').length
    stats.draft_forms = forms.filter((f: any) => f.status === 'draft').length

    // Get submission counts for each form
    for (const form of forms) {
      const { count } = await this.supabase
        .from('form_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('form_id', form.id)

      const submissionCount = count || 0
      stats.total_submissions += submissionCount

      stats.top_forms.push({
        form_id: form.id,
        form_name: form.name,
        submission_count: submissionCount,
      })
    }

    // Sort top forms by submission count
    stats.top_forms.sort((a, b) => b.submission_count - a.submission_count)
    stats.top_forms = stats.top_forms.slice(0, 5)

    // Get recent submissions (last 7 days)
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)

    const { count: recentCount } = await this.supabase
      .from('form_submissions')
      .select('*', { count: 'exact', head: true })
      .gte('submitted_at', weekAgo.toISOString())

    stats.recent_submissions = recentCount || 0

    return stats
  }

  /**
   * Get submissions for a form
   */
  async getFormSubmissions(formId: string): Promise<FormSubmission[]> {
    const { data, error } = await this.supabase
      .from('form_submissions')
      .select('*')
      .eq('form_id', formId)
      .order('submitted_at', { ascending: false })

    if (error) {
      console.error('Error fetching submissions:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get submission by ID
   */
  async getSubmissionById(id: string): Promise<FormSubmission | null> {
    const { data, error } = await this.supabase
      .from('form_submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching submission:', error)
      return null
    }

    return data
  }

  /**
   * Delete submission
   */
  async deleteSubmission(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('form_submissions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting submission:', error)
      throw error
    }
  }

  /**
   * Search forms
   */
  async searchForms(query: string): Promise<Form[]> {
    const { data, error } = await this.supabase
      .from('forms')
      .select('*')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error searching forms:', error)
      throw error
    }

    return data || []
  }

  /**
   * Duplicate form
   */
  async duplicateForm(formId: string, accountId: string): Promise<Form> {
    // Get original form with fields
    const originalForm = await this.getFormById(formId)
    
    if (!originalForm) {
      throw new Error('Form not found')
    }

    // Create new form
    const newFormData: CreateFormInput = {
      name: `${originalForm.name} (Copy)`,
      description: originalForm.description || undefined,
      status: 'draft',
      thank_you_message: originalForm.thank_you_message,
      submit_button_text: originalForm.submit_button_text,
      submit_button_color: originalForm.submit_button_color,
      background_color: originalForm.background_color,
      allow_multiple_submissions: originalForm.allow_multiple_submissions,
      collect_email: originalForm.collect_email,
      send_notification_email: originalForm.send_notification_email,
      notification_emails: originalForm.notification_emails || undefined,
    }

    const newForm = await this.createForm(newFormData, accountId)

    // Copy fields
    for (const field of originalForm.fields) {
      await this.supabase
        .from('form_fields')
        .insert({
          form_id: newForm.id,
          field_type: field.field_type,
          field_label: field.field_label,
          field_key: field.field_key,
          placeholder: field.placeholder,
          default_value: field.default_value,
          required: field.required,
          options: field.options,
          validation_rules: field.validation_rules,
          order_index: field.order_index,
          width: field.width,
        })
    }

    return newForm
  }
}
