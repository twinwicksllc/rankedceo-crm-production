// Form Builder Types

export type FieldType = 
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox'
  | 'file'
  | 'rating'
  | 'toggle'
  | 'hidden'
  | 'paragraph'

export type FieldWidth = 'full' | 'half' | 'third' | 'quarter'
export type FormStatus = 'draft' | 'published' | 'archived'

export type ValidationType = 
  | 'required'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'email'
  | 'url'
  | 'phone'

export interface ValidationRule {
  type: ValidationType
  value?: string | number
  message?: string
}

export interface FieldOption {
  label: string
  value: string
  disabled?: boolean
}

export interface FormField {
  id: string
  form_id: string
  field_type: FieldType
  field_label: string
  field_key: string
  placeholder?: string | null
  default_value?: string | null
  required: boolean
  options?: FieldOption[] | null
  validation_rules?: ValidationRule[] | null
  order_index: number
  width: FieldWidth
  created_at: string
  updated_at: string
}

export interface Form {
  id: string
  account_id: string
  name: string
  description?: string | null
  status: FormStatus
  public_url?: string | null
  thank_you_message: string
  submit_button_text: string
  submit_button_color: string
  background_color: string
  allow_multiple_submissions: boolean
  collect_email: boolean
  send_notification_email: boolean
  notification_emails: string[] | null
  created_at: string
  updated_at: string
}

export interface FormWithFields extends Form {
  fields: FormField[]
}

export interface FormSubmission {
  id: string
  form_id: string
  submission_data: Record<string, any>
  submitted_at: string
  ip_address?: string | null
  user_agent?: string | null
  referrer?: string | null
  contact_id?: string | null
}

export interface FormStats {
  total_forms: number
  published_forms: number
  draft_forms: number
  total_submissions: number
  recent_submissions: number
  top_forms: Array<{
    form_id: string
    form_name: string
    submission_count: number
  }>
}

export interface CreateFormFieldInput {
  field_type: FieldType
  field_label: string
  field_key: string
  placeholder?: string
  default_value?: string
  required?: boolean
  options?: FieldOption[]
  validation_rules?: ValidationRule[]
  order_index?: number
  width?: FieldWidth
}

export interface UpdateFormFieldInput {
  field_label?: string
  placeholder?: string
  default_value?: string
  required?: boolean
  options?: FieldOption[]
  validation_rules?: ValidationRule[]
  order_index?: number
  width?: FieldWidth
}

export interface CreateFormInput {
  name: string
  description?: string
  status?: FormStatus
  thank_you_message?: string
  submit_button_text?: string
  submit_button_color?: string
  background_color?: string
  allow_multiple_submissions?: boolean
  collect_email?: boolean
  send_notification_email?: boolean
  notification_emails?: string[]
}

export interface UpdateFormInput {
  name?: string
  description?: string
  status?: FormStatus
  thank_you_message?: string
  submit_button_text?: string
  submit_button_color?: string
  background_color?: string
  allow_multiple_submissions?: boolean
  collect_email?: boolean
  send_notification_email?: boolean
  notification_emails?: string[]
}

export interface SubmitFormInput {
  form_id: string
  submission_data: Record<string, any>
  recaptcha_token?: string
}

export interface FormFilters {
  search?: string
  status?: FormStatus
}

export interface SubmissionFilters {
  search?: string
  from_date?: string
  to_date?: string
}

export type ExportFormat = 'csv' | 'json'
