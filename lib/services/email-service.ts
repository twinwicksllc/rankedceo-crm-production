import { createClient } from '@/lib/supabase/client'
import { 
  EmailMessage, 
  EmailThread, 
  EmailMessageWithThread, 
  EmailThreadWithMessages,
  CreateEmailMessageInput,
  UpdateEmailMessageInput,
  CreateEmailThreadInput,
  UpdateEmailThreadInput,
  EmailFilters,
  EmailStats,
  ParsedEmail 
} from '@/lib/types/email'
import { EmailParser } from '@/lib/services/email-parser'

export class EmailService {
  private supabase: any

  constructor() {
    this.supabase = createClient()
  }

  /**
   * Get all email messages with optional filters
   */
  async getEmails(filters?: EmailFilters): Promise<EmailMessageWithThread[]> {
    let query = this.supabase
      .from('email_messages')
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .order('received_at', { ascending: false })

    if (filters?.search) {
      query = query.or(`subject.ilike.%${filters.search}%,from_address.ilike.%${filters.search}%`)
    }

    if (filters?.direction) {
      query = query.eq('direction', filters.direction)
    }

    if (filters?.contact_id) {
      query = query.eq('contact_id', filters.contact_id)
    }

    if (filters?.company_id) {
      query = query.eq('company_id', filters.company_id)
    }

    if (filters?.deal_id) {
      query = query.eq('deal_id', filters.deal_id)
    }

    if (filters?.thread_id) {
      query = query.eq('thread_id', filters.thread_id)
    }

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.from_date) {
      query = query.gte('received_at', filters.from_date)
    }

    if (filters?.to_date) {
      query = query.lte('received_at', filters.to_date)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching emails:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get email message by ID
   */
  async getEmailById(id: string): Promise<EmailMessageWithThread | null> {
    const { data, error } = await this.supabase
      .from('email_messages')
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching email:', error)
      return null
    }

    return data
  }

  /**
   * Get all email threads
   */
  async getEmailThreads(): Promise<EmailThreadWithMessages[]> {
    const { data, error } = await this.supabase
      .from('email_threads')
      .select(`
        *,
        messages:email_messages(
          id,
          from_address,
          from_name,
          subject,
          body_plain,
          received_at,
          direction
        )
      `)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching email threads:', error)
      throw error
    }

    const threads = data || []
    
    // Get latest message for each thread
    for (const thread of threads) {
      if (thread.messages && thread.messages.length > 0) {
        thread.latest_message = thread.messages[thread.messages.length - 1]
      } else {
        thread.latest_message = null
      }
    }

    return threads
  }

  /**
   * Get email thread by ID with all messages
   */
  async getEmailThreadById(id: string): Promise<EmailThreadWithMessages | null> {
    const { data, error } = await this.supabase
      .from('email_threads')
      .select(`
        *,
        messages:email_messages(*)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error fetching email thread:', error)
      return null
    }

    const thread = data
    
    // Sort messages by received date
    if (thread.messages) {
      thread.messages.sort((a: any, b: any) => 
        new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
      )
    }

    return thread
  }

  /**
   * Create new email message from parsed email
   */
  async createEmailFromParsed(parsedEmail: ParsedEmail, accountId: string): Promise<EmailMessageWithThread> {
    // Determine thread ID
    const threadId = EmailParser.determineThreadId(
      parsedEmail.in_reply_to,
      parsedEmail.references,
      parsedEmail.message_id
    )

    // Sanitize HTML content
    const sanitizedHtml = EmailParser.sanitizeHTML(parsedEmail.body_html)
    const cleanedPlain = EmailParser.cleanBody(parsedEmail.body_plain, 'plain')

    const emailData: CreateEmailMessageInput = {
      message_id: parsedEmail.message_id,
      in_reply_to: parsedEmail.in_reply_to,
      references: parsedEmail.references,
      from_address: parsedEmail.from_address,
      from_name: parsedEmail.from_name,
      to_addresses: parsedEmail.to_addresses,
      cc_addresses: parsedEmail.cc_addresses,
      bcc_addresses: parsedEmail.bcc_addresses,
      subject: parsedEmail.subject,
      body_plain: cleanedPlain,
      body_html: sanitizedHtml,
      direction: 'inbound',
      headers: parsedEmail.headers,
    }

    // If thread exists, add to it
    if (threadId) {
      // Check if thread exists
      const { data: existingThread } = await this.supabase
        .from('email_threads')
        .select('id')
        .eq('account_id', accountId)
        .ilike('subject', parsedEmail.subject)
        .single()

      if (existingThread) {
        emailData.thread_id = existingThread.id
      }
    }

    // If no thread, create one
    if (!emailData.thread_id) {
      const threadData: CreateEmailThreadInput = {
        subject: parsedEmail.subject,
        participants: [
          ...parsedEmail.to_addresses,
          ...(parsedEmail.cc_addresses || []),
          parsedEmail.from_address,
        ],
      }

      const { data: newThread, error: threadError } = await this.supabase
        .from('email_threads')
        .insert(threadData)
        .select()
        .single()

      if (threadError) {
        console.error('Error creating email thread:', threadError)
        throw threadError
      }

      emailData.thread_id = newThread.id
    }

    // Create email message
    const { data, error } = await this.supabase
      .from('email_messages')
      .insert({ ...emailData, account_id: accountId })
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .single()

    if (error) {
      console.error('Error creating email:', error)
      throw error
    }

    return data
  }

  /**
   * Create new email message
   */
  async createEmail(data: CreateEmailMessageInput, accountId: string): Promise<EmailMessageWithThread> {
    const { data: email, error } = await this.supabase
      .from('email_messages')
      .insert({ ...data, account_id: accountId })
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .single()

    if (error) {
      console.error('Error creating email:', error)
      throw error
    }

    return email
  }

  /**
   * Update email message
   */
  async updateEmail(id: string, data: UpdateEmailMessageInput): Promise<EmailMessageWithThread> {
    const { data: email, error } = await this.supabase
      .from('email_messages')
      .update({ ...data, updated_at: new Date().toISOString() })
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .eq('id', id)
      .single()

    if (error) {
      console.error('Error updating email:', error)
      throw error
    }

    return email
  }

  /**
   * Delete email message
   */
  async deleteEmail(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_messages')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting email:', error)
      throw error
    }
  }

  /**
   * Delete email thread
   */
  async deleteThread(id: string): Promise<void> {
    const { error } = await this.supabase
      .from('email_threads')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting email thread:', error)
      throw error
    }
  }

  /**
   * Get email statistics
   */
  async getEmailStats(): Promise<EmailStats> {
    const { data: messages } = await this.supabase
      .from('email_messages')
      .select('direction, received_at, opened')

    const stats: EmailStats = {
      total_messages: 0,
      total_threads: 0,
      inbound_count: 0,
      outbound_count: 0,
      unread_count: 0,
      today_count: 0,
      week_count: 0,
      month_count: 0,
    }

    if (!messages) return stats

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    stats.total_messages = messages.length

    for (const msg of messages) {
      if (msg.direction === 'inbound') stats.inbound_count++
      if (msg.direction === 'outbound') stats.outbound_count++
      if (!msg.opened) stats.unread_count++

      const receivedDate = new Date(msg.received_at)
      if (receivedDate >= today) stats.today_count++
      if (receivedDate >= weekAgo) stats.week_count++
      if (receivedDate >= monthAgo) stats.month_count++
    }

    // Get thread count
    const { data: threads } = await this.supabase
      .from('email_threads')
      .select('id')

    stats.total_threads = threads?.length || 0

    return stats
  }

  /**
   * Mark email as opened
   */
  async markAsOpened(id: string): Promise<void> {
    await this.updateEmail(id, {
      opened: true,
    })
  }

  /**
   * Mark all emails in thread as opened
   */
  async markThreadAsOpened(threadId: string): Promise<void> {
    await this.supabase
      .from('email_messages')
      .update({ 
        opened: true,
        opened_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('thread_id', threadId)
  }

  /**
   * Get or create BCC email address for account
   */
  async getOrCreateBccEmailAddress(accountId: string): Promise<string> {
    // First try to get existing BCC address
    const { data: account } = await this.supabase
      .from('accounts')
      .select('bcc_email_address')
      .eq('id', accountId)
      .single()

    if (account?.bcc_email_address) {
      return account.bcc_email_address
    }

    // Generate new BCC address
    const bccAddress = this.generateBccAddress(accountId)

    // Update account with new BCC address
    const { error } = await this.supabase
      .from('accounts')
      .update({ bcc_email_address: bccAddress })
      .eq('id', accountId)

    if (error) {
      console.error('Error creating BCC address:', error)
      throw error
    }

    return bccAddress
  }

  /**
   * Generate unique BCC email address for account
   */
  private generateBccAddress(accountId: string): string {
    // Use a short hash of the account ID to create a memorable address
    const shortId = accountId.substring(0, 8)
    return `bcc-${shortId}@crm.rankededo.com`
  }

  /**
   * Search emails by content
   */
  async searchEmails(query: string): Promise<EmailMessageWithThread[]> {
    const { data, error } = await this.supabase
      .from('email_messages')
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .or(`subject.ilike.%${query}%,body_plain.ilike.%${query}%,from_address.ilike.%${query}%`)
      .order('received_at', { ascending: false })

    if (error) {
      console.error('Error searching emails:', error)
      throw error
    }

    return data || []
  }

  /**
   * Get emails for contact
   */
  async getEmailsByContact(contactId: string): Promise<EmailMessageWithThread[]> {
    return this.getEmails({ contact_id: contactId })
  }

  /**
   * Get emails for company
   */
  async getEmailsByCompany(companyId: string): Promise<EmailMessageWithThread[]> {
    return this.getEmails({ company_id: companyId })
  }

  /**
   * Get emails for deal
   */
  async getEmailsByDeal(dealId: string): Promise<EmailMessageWithThread[]> {
    return this.getEmails({ deal_id: dealId })
  }

  /**
   * Get recent emails
   */
  async getRecentEmails(limit: number = 10): Promise<EmailMessageWithThread[]> {
    const { data, error } = await this.supabase
      .from('email_messages')
      .select(`
        *,
        thread:email_threads(*),
        contact:contacts(id, name, email),
        company:companies(id, name),
        deal:deals(id, name, value)
      `)
      .order('received_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching recent emails:', error)
      throw error
    }

    return data || []
  }
}