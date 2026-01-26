// Campaign Service for RankedCEO CRM
import { createClient } from '@/lib/supabase/server';
import { SendGridService } from './sendgrid-service';
import type {
  Campaign,
  CampaignWithRelations,
  CreateCampaignInput,
  UpdateCampaignInput,
  CampaignFilters,
  EmailTemplate,
  EmailTemplateWithRelations,
  CreateEmailTemplateInput,
  UpdateEmailTemplateInput,
  CampaignSequence,
  CampaignSequenceWithRelations,
  CreateCampaignSequenceInput,
  UpdateCampaignSequenceInput,
  CampaignAnalytics,
  CampaignEmail,
  CampaignEmailWithRelations,
} from '@/lib/types/campaign';
import {
  createCampaignSchema,
  updateCampaignSchema,
  createEmailTemplateSchema,
  updateEmailTemplateSchema,
  createCampaignSequenceSchema,
  updateCampaignSequenceSchema,
} from '@/lib/validations/campaign';

export class CampaignService {
  private supabase!: any;
  private sendGridService: SendGridService;

  constructor() {
    this.sendGridService = new SendGridService(process.env.SENDGRID_API_KEY || '');
  this.supabase = createClient();
  }

  // ==================== EMAIL TEMPLATES ====================

  /**
   * Get all email templates for the account
   */
  async getTemplates(search?: string): Promise<EmailTemplate[]> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    let query = await this.supabase
      .from('email_templates')
      .select('*')
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single email template by ID
   */
  async getTemplate(id: string): Promise<EmailTemplateWithRelations> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('email_templates')
      .select(`
        *,
        created_by_user:users!email_templates_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new email template
   */
  async createTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    // Validate input
    const validatedData = createEmailTemplateSchema.parse(input);

    // Extract variables from content
    const variables = SendGridService.extractTemplateVariables(validatedData.subject + ' ' + validatedData.body);

    const { data, error } = await this.supabase
      .from('email_templates')
      .insert({
        account_id: userData.data.user.user_metadata.account_id,
        ...validatedData,
        variables,
        created_by: userData.data.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update an email template
   */
  async updateTemplate(id: string, input: UpdateEmailTemplateInput): Promise<EmailTemplate> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    // Validate input
    const validatedData = updateEmailTemplateSchema.parse(input);

    // Extract variables if content is being updated
    let variables = undefined;
    if (validatedData.subject || validatedData.body) {
      const template = await this.getTemplate(id);
      const subject = validatedData.subject || template.subject;
      const body = validatedData.body || template.body;
      variables = SendGridService.extractTemplateVariables(subject + ' ' + body);
    }

    const { data, error } = await this.supabase
      .from('email_templates')
      .update({
        ...validatedData,
        ...(variables && { variables }),
      })
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete an email template
   */
  async deleteTemplate(id: string): Promise<void> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id);

    if (error) throw error;
  }

  // ==================== CAMPAIGNS ====================

  /**
   * Get all campaigns for the account
   */
  async getCampaigns(filters?: CampaignFilters): Promise<CampaignWithRelations[]> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    let query = await this.supabase
      .from('campaigns')
      .select(`
        *,
        template:email_templates(*),
        created_by_user:users!campaigns_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        ),
        analytics:campaign_analytics(*)
      `)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters?.from_date) {
      query = query.gte('created_at', filters.from_date);
    }

    if (filters?.to_date) {
      query = query.lte('created_at', filters.to_date);
    }

    const { data, error } = await query;

    if (error) throw error;
    
    // Add sequence count and recipient count for each campaign
    const campaigns = await Promise.all(
      (data || []).map(async (campaign: any) => {
        const [sequenceCount, recipientCount] = await Promise.all([
          this.getSequenceCount(campaign.id),
          this.getRecipientCount(campaign.id),
        ]);

        return {
          ...campaign,
          sequence_count: sequenceCount,
          recipient_count: recipientCount,
        };
      })
    );

    return campaigns;
  }

  /**
   * Get a single campaign by ID
   */
  async getCampaign(id: string): Promise<CampaignWithRelations> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('campaigns')
      .select(`
        *,
        template:email_templates(*),
        created_by_user:users!campaigns_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        ),
        analytics:campaign_analytics(*)
      `)
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .single();

    if (error) throw error;

    // Add sequence count and recipient count
    const [sequenceCount, recipientCount] = await Promise.all([
      this.getSequenceCount(id),
      this.getRecipientCount(id),
    ]);

    return {
      ...data,
      sequence_count: sequenceCount,
      recipient_count: recipientCount,
    };
  }

  /**
   * Create a new campaign
   */
  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    // Validate input
    const validatedData = createCampaignSchema.parse(input);

    const { data, error } = await this.supabase
      .from('campaigns')
      .insert({
        account_id: userData.data.user.user_metadata.account_id,
        ...validatedData,
        created_by: userData.data.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a campaign
   */
  async updateCampaign(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    // Validate input
    const validatedData = updateCampaignSchema.parse(input);

    const { data, error } = await this.supabase
      .from('campaigns')
      .update(validatedData)
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(id: string): Promise<void> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id);

    if (error) throw error;
  }

  /**
   * Duplicate a campaign
   */
  async duplicateCampaign(id: string): Promise<Campaign> {
    const originalCampaign = await this.getCampaign(id);
    
    const { data, error } = await this.supabase
      .from('campaigns')
      .insert({
        account_id: originalCampaign.account_id,
        name: `${originalCampaign.name} (Copy)`,
        description: originalCampaign.description,
        type: originalCampaign.type,
        status: 'draft',
        subject: originalCampaign.subject,
        body: originalCampaign.body,
        from_email: originalCampaign.from_email,
        from_name: originalCampaign.from_name,
        template_id: originalCampaign.template_id,
        target_contacts: originalCampaign.target_contacts,
        target_companies: originalCampaign.target_companies,
        target_deals: originalCampaign.target_deals,
        segments: originalCampaign.segments,
        is_ab_test: originalCampaign.is_ab_test,
        ab_test_variants: originalCampaign.ab_test_variants,
        created_by: originalCampaign.created_by,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Send a campaign
   */
  async sendCampaign(id: string): Promise<void> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const campaign = await this.getCampaign(id);

    if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
      throw new Error('Campaign must be in draft or scheduled status to send');
    }

    // Get target recipients
    const recipients = await this.getRecipients(campaign);

    if (recipients.length === 0) {
      throw new Error('No recipients found for this campaign');
    }

    // Create campaign emails
    const campaignEmails = recipients.map(recipient => ({
      account_id: campaign.account_id,
      campaign_id: campaign.id,
      contact_id: recipient.contact_id,
      company_id: recipient.company_id,
      deal_id: recipient.deal_id,
      to_email: recipient.email,
      to_name: recipient.name,
      subject: campaign.subject,
      body: this.personalizeContent(campaign.body, recipient.variables),
      variant: this.getABTestVariant(campaign),
    }));

    // Insert campaign emails
    const { data: insertedEmails, error: insertError } = await this.supabase
      .from('campaign_emails')
      .insert(campaignEmails)
      .select();

    if (insertError) throw insertError;

    // Send emails via SendGrid
    const sendResults = await this.sendGridService.sendBulkEmails(
      insertedEmails.map((email: any) => ({
        to: email.to_email,
        toName: email.to_name,
        from: campaign.from_email || process.env.SENDGRID_FROM_EMAIL || 'noreply@rankedceo.com',
        fromName: campaign.from_name || 'RankedCEO',
        subject: email.subject,
        html: email.body,
        customArgs: {
          campaign_id: campaign.id,
          campaign_email_id: email.id,
        },
      }))
    );

    // Update campaign emails with SendGrid results
    await Promise.all(
      insertedEmails.map(async (email: any, index: number) => {
        const result = sendResults[index];
        await this.supabase
          .from('campaign_emails')
          .update({
            sendgrid_message_id: result.messageId,
            status: result.success ? 'sent' : 'failed',
            error_message: result.errors?.join(', '),
            sent_at: new Date().toISOString(),
          })
          .eq('id', email.id);
      })
    );

    // Update campaign status
    await this.supabase
      .from('campaigns')
      .update({
        status: 'active',
        sent_at: new Date().toISOString(),
      })
      .eq('id', id);
  }

  /**
   * Get campaign statistics
   */
  async getCampaignStats(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    scheduledCampaigns: number;
    draftCampaigns: number;
    totalEmailsSent: number;
    totalOpens: number;
    totalClicks: number;
    averageOpenRate: number;
    averageClickRate: number;
  }> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { data: campaigns } = await this.supabase
      .from('campaigns')
      .select('id, status')
      .eq('account_id', userData.data.user.user_metadata.account_id);

    const { data: analytics } = await this.supabase
      .from('campaign_analytics')
      .select('total_sent, total_opened, total_clicked, open_rate, click_rate')
      .eq('account_id', userData.data.user.user_metadata.account_id);

    const totalCampaigns = campaigns?.length || 0;
    const activeCampaigns = campaigns?.filter((c: any) => c.status === 'active').length || 0;
    const scheduledCampaigns = campaigns?.filter((c: any) => c.status === 'scheduled').length || 0;
    const draftCampaigns = campaigns?.filter((c: any) => c.status === 'draft').length || 0;

    const totalEmailsSent = analytics?.reduce((sum: any, a: any) => sum + a.total_sent, 0) || 0;
    const totalOpens = analytics?.reduce((sum: any, a: any) => sum + a.total_opened, 0) || 0;
    const totalClicks = analytics?.reduce((sum: any, a: any) => sum + a.total_clicked, 0) || 0;

    const averageOpenRate = analytics?.length 
      ? analytics.reduce((sum: any, a: any) => sum + a.open_rate, 0) / analytics.length 
      : 0;
    
    const averageClickRate = analytics?.length 
      ? analytics.reduce((sum: any, a: any) => sum + a.click_rate, 0) / analytics.length 
      : 0;

    return {
      totalCampaigns,
      activeCampaigns,
      scheduledCampaigns,
      draftCampaigns,
      totalEmailsSent,
      totalOpens,
      totalClicks,
      averageOpenRate,
      averageClickRate,
    };
  }

  // ==================== CAMPAIGN SEQUENCES ====================

  /**
   * Get all sequences for a campaign
   */
  async getSequences(campaignId: string): Promise<CampaignSequenceWithRelations[]> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('campaign_sequences')
      .select(`
        *,
        template:email_templates(*),
        created_by_user:users!campaign_sequences_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .eq('campaign_id', campaignId)
      .order('step_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single sequence by ID
   */
  async getSequence(id: string): Promise<CampaignSequenceWithRelations> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { data, error } = await this.supabase
      .from('campaign_sequences')
      .select(`
        *,
        template:email_templates(*),
        created_by_user:users!campaign_sequences_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new sequence step
   */
  async createSequence(input: CreateCampaignSequenceInput): Promise<CampaignSequence> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    // Validate input
    const validatedData = createCampaignSequenceSchema.parse(input);

    const { data, error } = await this.supabase
      .from('campaign_sequences')
      .insert({
        account_id: userData.data.user.user_metadata.account_id,
        ...validatedData,
        created_by: userData.data.user.id,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update a sequence step
   */
  async updateSequence(id: string, input: UpdateCampaignSequenceInput): Promise<CampaignSequence> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    // Validate input
    const validatedData = updateCampaignSequenceSchema.parse(input);

    const { data, error } = await this.supabase
      .from('campaign_sequences')
      .update(validatedData)
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a sequence step
   */
  async deleteSequence(id: string): Promise<void> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    const { error } = await this.supabase
      .from('campaign_sequences')
      .delete()
      .eq('id', id)
      .eq('account_id', userData.data.user.user_metadata.account_id);

    if (error) throw error;
  }

  // ==================== CAMPAIGN EMAILS ====================

  /**
   * Get emails for a campaign
   */
  async getCampaignEmails(campaignId: string, filters?: {
    status?: string;
    search?: string;
  }): Promise<CampaignEmailWithRelations[]> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) throw new Error('User not authenticated');

    let query = await this.supabase
      .from('campaign_emails')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email),
        company:companies(id, name),
        deal:deals(id, name)
      `)
      .eq('account_id', userData.data.user.user_metadata.account_id)
      .eq('campaign_id', campaignId)
      .order('sent_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.search) {
      query = query.or(`to_email.ilike.%${filters.search}%,to_name.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Update campaign email tracking
   */
  async updateCampaignEmailTracking(
    campaignEmailId: string,
    updates: {
      opened_at?: string;
      clicked_at?: string;
      bounced_at?: string;
      bounced_reason?: string;
      unsubscribed_at?: string;
      spam_reported_at?: string;
      open_count?: number;
      click_count?: number;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('campaign_emails')
      .update(updates)
      .eq('id', campaignEmailId);

    if (error) throw error;
  }

  // ==================== HELPER METHODS ====================

  /**
   * Get sequence count for a campaign
   */
  private async getSequenceCount(campaignId: string): Promise<number> {
    const { count } = await this.supabase
      .from('campaign_sequences')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    return count || 0;
  }

  /**
   * Get recipient count for a campaign
   */
  private async getRecipientCount(campaignId: string): Promise<number> {
    const { count } = await this.supabase
      .from('campaign_emails')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaignId);

    return count || 0;
  }

  /**
   * Get recipients for a campaign
   */
  private async getRecipients(campaign: Campaign): Promise<any[]> {
    const recipients: any[] = [];

    // Get contacts
    if (campaign.target_contacts.length > 0) {
      const { data: contacts } = await this.supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_id')
        .in('id', campaign.target_contacts);

      recipients.push(...(contacts || []).map((contact: any) => ({
        contact_id: contact.id,
        company_id: contact.company_id,
        email: contact.email,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        variables: {
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          email: contact.email,
        },
      })));
    }

    // Get contacts from companies
    if (campaign.target_companies.length > 0) {
      const { data: companyContacts } = await this.supabase
        .from('contacts')
        .select('id, first_name, last_name, email, company_id')
        .in('company_id', campaign.target_companies);

      recipients.push(...(companyContacts || []).map((contact: any) => ({
        contact_id: contact.id,
        company_id: contact.company_id,
        email: contact.email,
        name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        variables: {
          first_name: contact.first_name || '',
          last_name: contact.last_name || '',
          email: contact.email,
        },
      })));
    }

    // Get contacts from deals
    if (campaign.target_deals.length > 0) {
      const { data: deals } = await this.supabase
        .from('deals')
        .select('id, name, contact_id, company_id')
        .in('id', campaign.target_deals);

      for (const deal of deals || []) {
        if (deal.contact_id) {
          const { data: contact } = await this.supabase
            .from('contacts')
            .select('id, first_name, last_name, email, company_id')
            .eq('id', deal.contact_id)
            .single();

          if (contact) {
            recipients.push({
              contact_id: contact.id,
              company_id: contact.company_id,
              deal_id: deal.id,
              email: contact.email,
              name: `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
              variables: {
                first_name: contact.first_name || '',
                last_name: contact.last_name || '',
                email: contact.email,
                deal_name: deal.name,
              },
            });
          }
        }
      }
    }

    // Remove duplicates based on email
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.email === recipient.email)
    );

    return uniqueRecipients;
  }

  /**
   * Personalize content with variables
   */
  private personalizeContent(content: string, variables: Record<string, any>): string {
    return SendGridService.replaceTemplateVariables(content, variables);
  }

  /**
   * Get A/B test variant
   */
  private getABTestVariant(campaign: Campaign): number {
    if (!campaign.is_ab_test || campaign.ab_test_variants.length === 0) {
      return 0;
    }

    // Simple random assignment (can be enhanced with weighted distribution)
    return Math.floor(Math.random() * campaign.ab_test_variants.length);
  }
}