import { ParsedEmail } from '@/lib/types/email'

/**
 * Email Parser Service
 * Parses incoming email data from various sources (SendGrid webhooks, IMAP, etc.)
 * and extracts structured information.
 */

export class EmailParser {
  /**
   * Parse email from SendGrid Inbound Parse webhook
   */
  static parseFromSendGrid(webhookData: any): ParsedEmail {
    const headers: Record<string, any> = this.extractHeaders(webhookData)
    
    const parsedEmail: ParsedEmail = {
      from_address: this.extractEmail(webhookData.from || ''),
      from_name: this.extractName(webhookData.from || ''),
      to_addresses: this.extractEmails(webhookData.to || ''),
      cc_addresses: webhookData.cc ? this.extractEmails(webhookData.cc) : null,
      bcc_addresses: webhookData.bcc ? this.extractEmails(webhookData.bcc) : null,
      subject: webhookData.subject || 'No Subject',
      body_plain: webhookData.text || null,
      body_html: webhookData.html || null,
      message_id: this.getMessageId(headers),
      in_reply_to: headers['in-reply-to'] || headers['In-Reply-To'] || null,
      references: this.parseReferences(headers['references'] || headers['References']),
      headers,
      attachments: this.parseAttachments(webhookData.attachments || []),
    }
    
    return parsedEmail
  }

  /**
   * Parse email from raw MIME message
   */
  static parseFromMIME(rawMIME: string): ParsedEmail {
    // This is a simplified parser. For production, use a library like `mailparser`
    const lines = rawMIME.split('\n')
    const headers: Record<string, any> = {}
    let headerEndIndex = 0
    
    // Parse headers
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line === '') {
        headerEndIndex = i
        break
      }
      
      const colonIndex = line.indexOf(':')
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim()
        const value = line.substring(colonIndex + 1).trim()
        headers[key] = value
      }
    }
    
    const body = lines.slice(headerEndIndex + 1).join('\n')
    
    return {
      from_address: this.extractEmail(headers['From'] || ''),
      from_name: this.extractName(headers['From'] || ''),
      to_addresses: this.extractEmails(headers['To'] || ''),
      cc_addresses: headers['Cc'] ? this.extractEmails(headers['Cc']) : null,
      bcc_addresses: headers['Bcc'] ? this.extractEmails(headers['Bcc']) : null,
      subject: headers['Subject'] || 'No Subject',
      body_plain: body || null,
      body_html: null, // Would need proper MIME parsing to separate HTML
      message_id: this.getMessageId(headers),
      in_reply_to: headers['In-Reply-To'] || null,
      references: this.parseReferences(headers['References']),
      headers,
    }
  }

  /**
   * Extract headers from webhook data
   */
  private static extractHeaders(webhookData: any): Record<string, any> {
    const headers: Record<string, any> = {}
    
    if (webhookData.headers) {
      if (Array.isArray(webhookData.headers)) {
        webhookData.headers.forEach((header: any) => {
          headers[header.name] = header.value
        })
      } else if (typeof webhookData.headers === 'object') {
        Object.assign(headers, webhookData.headers)
      }
    }
    
    // Add common headers from top-level properties
    if (webhookData['Message-ID']) headers['Message-ID'] = webhookData['Message-ID']
    if (webhookData['In-Reply-To']) headers['In-Reply-To'] = webhookData['In-Reply-To']
    if (webhookData['References']) headers['References'] = webhookData['References']
    if (webhookData['Date']) headers['Date'] = webhookData['Date']
    
    return headers
  }

  /**
   * Extract email address from "Name <email@domain.com>" format
   */
  private static extractEmail(address: string): string {
    const emailMatch = address.match(/<([^>]+)>/) || address.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/)
    return emailMatch ? emailMatch[1].trim() : address.trim()
  }

  /**
   * Extract name from "Name <email@domain.com>" format
   */
  private static extractName(address: string): string | null {
    const nameMatch = address.match(/^"?([^"<>]+)"?\s*<[^>]+>$/)
    if (nameMatch) {
      return nameMatch[1].trim()
    }
    
    // Try alternate format
    const nameMatch2 = address.match(/<[^>]+>\s*"?([^"<>]+)"?$/)
    if (nameMatch2) {
      return nameMatch2[1].trim()
    }
    
    return null
  }

  /**
   * Extract multiple email addresses
   */
  private static extractEmails(addresses: string): string[] {
    if (!addresses) return []
    
    const emailRegex = /<([^>]+)>/g
    const emails: string[] = []
    let match
    
    while ((match = emailRegex.exec(addresses)) !== null) {
      emails.push(match[1].trim())
    }
    
    // If no angle brackets found, try extracting emails directly
    if (emails.length === 0) {
      const directRegex = /([^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+)/g
      while ((match = directRegex.exec(addresses)) !== null) {
        emails.push(match[1].trim())
      }
    }
    
    return emails
  }

  /**
   * Get Message-ID from headers
   */
  private static getMessageId(headers: Record<string, any>): string {
    const messageId = headers['Message-ID'] || headers['message-id'] || headers['Message-Id']
    if (messageId) {
      return messageId.replace(/[<>]/g, '').trim()
    }
    
    // Generate a fallback Message-ID
    return `<${Date.now()}@rankedceo.com>`
  }

  /**
   * Parse References header into array
   */
  private static parseReferences(references: any): string[] | null {
    if (!references) return null
    
    const refs = Array.isArray(references) 
      ? references 
      : references.toString().split(/\s+/)
    
    return refs
      .map((ref: string) => ref.replace(/[<>]/g, '').trim())
      .filter((ref: string) => ref.length > 0)
  }

  /**
   * Parse attachments from webhook data
   */
  private static parseAttachments(attachments: any[]): Array<{
    filename: string
    content_type: string
    content: string
    size: number
  }> {
    if (!attachments || !Array.isArray(attachments)) return []
    
    return attachments.map((att: any) => ({
      filename: att.filename || 'unknown',
      content_type: att.type || 'application/octet-stream',
      content: att.content || '',
      size: att.content ? att.content.length : 0,
    }))
  }

  /**
   * Determine thread ID based on email headers
   */
  static determineThreadId(
    inReplyTo: string | null,
    references: string[] | null,
    message_id: string
  ): string | null {
    // Check in-reply-to first
    if (inReplyTo) {
      return inReplyTo.replace(/[<>]/g, '').trim()
    }
    
    // Check references array
    if (references && references.length > 0) {
      return references[references.length - 1] // Return the oldest reference (first message)
    }
    
    // No thread found, this is a new thread
    return null
  }

  /**
   * Extract quoted text from email body
   */
  static extractQuotedText(body: string | null): string | null {
    if (!body) return null
    
    const quotedPatterns = [
      /^(>.*\n?)+/gm, // "> quoted text" format
      /On .+ wrote:.*$/gm, // "On date, person wrote:" format
      /-+Original Message-+.*$/gm, // "-----Original Message-----" format
    ]
    
    for (const pattern of quotedPatterns) {
      const match = body.match(pattern)
      if (match) {
        return match[0]
      }
    }
    
    return null
  }

  /**
   * Clean email body by removing quoted text and signatures
   */
  static cleanBody(body: string | null, format: 'plain' | 'html' = 'plain'): string | null {
    if (!body) return null
    
    let cleanedBody = body
    
    if (format === 'plain') {
      // Remove quoted text
      const quotedText = this.extractQuotedText(cleanedBody)
      if (quotedText) {
        cleanedBody = cleanedBody.replace(quotedText, '').trim()
      }
      
      // Remove common signature patterns
      const signaturePatterns = [
        /--\s*\n.*$/gm, // "-- \nSignature" format
        /Best regards,.*$/gim,
        /Thanks,.*$/gim,
        /Sincerely,.*$/gim,
      ]
      
      for (const pattern of signaturePatterns) {
        cleanedBody = cleanedBody.replace(pattern, '').trim()
      }
    }
    
    return cleanedBody.trim() || null
  }

  /**
   * Sanitize HTML email content
   */
  static sanitizeHTML(html: string | null): string | null {
    if (!html) return null
    
    // Basic HTML sanitization (in production, use DOMPurify or similar)
    // Remove potentially dangerous tags and attributes
    let sanitized = html
    
    const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form']
    dangerousTags.forEach(tag => {
      const regex = new RegExp(`<${tag}[^>]*>.*?</${tag}>`, 'gis')
      sanitized = sanitized.replace(regex, '')
    })
    
    // Remove inline event handlers
    sanitized = sanitized.replace(/\s+on\w+="[^"]*"/gi, '')
    sanitized = sanitized.replace(/\s+on\w+='[^']*'/gi, '')
    
    return sanitized
  }

  /**
   * Extract email preview text
   */
  static extractPreviewText(body: string | null, maxLength: number = 150): string {
    if (!body) return 'No content'
    
    let preview = body
    
    // Remove HTML tags if HTML content
    if (body.includes('<')) {
      preview = preview.replace(/<[^>]+>/g, ' ')
    }
    
    // Remove extra whitespace
    preview = preview.replace(/\s+/g, ' ').trim()
    
    // Truncate if too long
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...'
    }
    
    return preview
  }
}