import { FormField, ValidationRule } from '@/lib/types/form'

export class FormValidationService {
  /**
   * Validate form data against form fields
   */
  static validateFormData(
    fields: FormField[],
    data: Record<string, any>
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {}

    for (const field of fields) {
      const value = data[field.field_key]
      const fieldErrors = this.validateField(field, value)

      if (fieldErrors.length > 0) {
        errors[field.field_key] = fieldErrors[0]
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    }
  }

  /**
   * Validate a single field value
   */
  static validateField(field: FormField, value: any): string[] {
    const errors: string[] = []

    // Get validation rules
    const rules = field.validation_rules || []

    // Apply custom validation rules
    for (const rule of rules) {
      const error = this.applyValidationRule(rule, value, field)
      if (error) {
        errors.push(error)
      }
    }

    // Default validation based on field type
    if (!errors.includes('') && value !== undefined && value !== null && value !== '') {
      const typeError = this.validateByFieldType(field.field_type, value)
      if (typeError) {
        errors.push(typeError)
      }
    }

    return errors
  }

  /**
   * Apply a validation rule
   */
  private static applyValidationRule(
    rule: ValidationRule,
    value: any,
    field: FormField
  ): string | null {
    switch (rule.type) {
      case 'required':
        if (value === undefined || value === null || value === '') {
          return rule.message || `${field.field_label} is required`
        }
        break

      case 'minLength':
        if (typeof value === 'string' && value.length < (rule.value as number)) {
          return rule.message || `${field.field_label} must be at least ${rule.value} characters`
        }
        break

      case 'maxLength':
        if (typeof value === 'string' && value.length > (rule.value as number)) {
          return rule.message || `${field.field_label} must not exceed ${rule.value} characters`
        }
        break

      case 'min':
        if (typeof value === 'number' && value < (rule.value as number)) {
          return rule.message || `${field.field_label} must be at least ${rule.value}`
        }
        break

      case 'max':
        if (typeof value === 'number' && value > (rule.value as number)) {
          return rule.message || `${field.field_label} must not exceed ${rule.value}`
        }
        break

      case 'pattern':
        if (typeof value === 'string') {
          const regex = new RegExp(rule.value as string)
          if (!regex.test(value)) {
            return rule.message || `${field.field_label} format is invalid`
          }
        }
        break

      case 'email':
        if (typeof value === 'string' && !this.isValidEmail(value)) {
          return rule.message || `${field.field_label} must be a valid email address`
        }
        break

      case 'url':
        if (typeof value === 'string' && !this.isValidUrl(value)) {
          return rule.message || `${field.field_label} must be a valid URL`
        }
        break

      case 'phone':
        if (typeof value === 'string' && !this.isValidPhone(value)) {
          return rule.message || `${field.field_label} must be a valid phone number`
        }
        break

      default:
        break
    }

    return null
  }

  /**
   * Validate by field type
   */
  private static validateByFieldType(fieldType: string, value: any): string | null {
    switch (fieldType) {
      case 'email':
        if (!this.isValidEmail(value)) {
          return 'Please enter a valid email address'
        }
        break

      case 'url':
        if (!this.isValidUrl(value)) {
          return 'Please enter a valid URL'
        }
        break

      case 'phone':
        if (!this.isValidPhone(value)) {
          return 'Please enter a valid phone number'
        }
        break

      case 'number':
        if (isNaN(Number(value))) {
          return 'Please enter a valid number'
        }
        break

      default:
        break
    }

    return null
  }

  /**
   * Check if string is valid email
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Check if string is valid URL
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Check if string is valid phone number
   */
  private static isValidPhone(phone: string): boolean {
    // Simple phone validation - allows +, digits, spaces, hyphens, parentheses
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
    return phoneRegex.test(phone.replace(/\s/g, ''))
  }

  /**
   * Sanitize form data
   */
  static sanitizeFormData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {}

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Remove HTML tags and sanitize
        sanitized[key] = value
          .replace(/<[^>]*>/g, '')
          .trim()
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map(v => 
          typeof v === 'string' ? v.replace(/<[^>]*>/g, '').trim() : v
        )
      } else {
        sanitized[key] = value
      }
    }

    return sanitized
  }

  /**
   * Get field default value
   */
  static getFieldValue(field: FormField, data: Record<string, any>): any {
    return data[field.field_key] !== undefined 
      ? data[field.field_key] 
      : field.default_value
  }
}
