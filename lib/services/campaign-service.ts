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

  /**
   * Helper method to get the current user's account_id and user_id
   */
  private async getUserInfo(): Promise<{ accountId: string; userId: string }> {
    const userData = await this.supabase.auth.getUser();
    if (!userData.data.user) {
      throw new Error('User not authenticated');
    }

    const { data: accountData, error: accountError } = await this.supabase
      .from('users')
      .select('account_id, id')
      .eq('email', userData.data.user.email)
      .single();

    if (accountError || !accountData) {
      throw new Error('Account not found');
    }

    return {
      accountId: accountData.account_id,
      userId: accountData.id,
    };
  }

  // ==================== EMAIL TEMPLATES ====================

  /**
   * Get all email templates for the account
   */
  async getTemplates(search?: string): Promise<EmailTemplate[]> {
    try {
      const { accountId } = await this.getUserInfo();

      let query = await this.supabase
        .from('email_templates')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('[CampaignService] Error getting templates:', error);
      return [];
    }
  }

  /**
   * Get a single email template by ID
   */
  async getTemplate(id: string): Promise<EmailTemplateWithRelations> {
    const { accountId } = await this.getUserInfo();

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
      .eq('account_id', accountId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new email template
   */
  async createTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const { accountId, userId } = await this.getUserInfo();

    // Validate input
    const validatedData = createEmailTemplateSchema.parse(input);

    // Extract variables from content
    const variables = SendGridService.extractTemplateVariables(validatedData.subject + ' ' + validatedData.body);

    const { data, error } = await this.supabase
      .from('email_templates')
      .insert({
        account_id: accountId,
        created_by: userId,
        ...validatedData,
        variables,
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
    const { accountId } = await this.getUserInfo();

    // Validate input
    const validatedData = updateEmailTemplateSchema.parse(input);

    // Extract variables from content
    const variables = SendGridService.extractTemplateVariables(validatedData.subject + ' ' + validatedData.body);

    const { data, error } = await this.supabase
      .from('email_templates')
      .update({
        ...validatedData,
        variables,
      })
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete an email template
   */
  async deleteTemplate(id: string): Promise<void> {
    const { accountId } = await this.getUserInfo();

    const { error } = await this.supabase
      .from('email_templates')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) throw error;
  }

  // ==================== CAMPAIGNS ====================

  /**
   * Get all campaigns for the account
   */
  async getCampaigns(filters?: CampaignFilters): Promise<Campaign[]> {
    const { accountId } = await this.getUserInfo();

    let query = await this.supabase
      .from('campaigns')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a single campaign by ID
   */
  async getCampaign(id: string): Promise<CampaignWithRelations> {
    const { accountId } = await this.getUserInfo();

    const { data, error } = await this.supabase
      .from('campaigns')
      .select(`
        *,
        pipeline:pipelines!campaigns_pipeline_id_fkey (
          id,
          name
        ),
        created_by_user:users!campaigns_created_by_fkey (
          id,
          email,
          first_name,
          last_name
        )
      `)
      .eq('id', id)
      .eq('account_id', accountId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new campaign
   */
  async createCampaign(input: CreateCampaignInput): Promise<Campaign> {
    const { accountId, userId } = await this.getUserInfo();

    // Validate input
    const validatedData = createCampaignSchema.parse(input);

    const { data, error } = await this.supabase
      .from('campaigns')
      .insert({
        account_id: accountId,
        created_by: userId,
        ...validatedData,
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
    const { accountId } = await this.getUserInfo();

    // Validate input
    const validatedData = updateCampaignSchema.parse(input);

    const { data, error } = await this.supabase
      .from('campaigns')
      .update(validatedData)
      .eq('id', id)
      .eq('account_id', accountId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a campaign
   */
  async deleteCampaign(id: string): Promise<void> {
    const { accountId } = await this.getUserInfo();

    const { error } = await this.supabase
      .from('campaigns')
      .delete()
      .eq('id', id)
      .eq('account_id', accountId);

    if (error) throw error;
  }

  // ==================== CAMPAIGN STATISTICS ====================

  /**
   * Get campaign statistics
   */
  async getCampaignStats(): Promise<{
    totalCampaigns: number;
    activeCampaigns: number;
    totalEmailsSent: number;
    totalOpens: number;
    totalClicks: number;
  }> {
    const { accountId } = await this.getUserInfo();

    const [campaignsResult, emailsResult] = await Promise.all([
      this.supabase
        .from('campaigns')
        .select('id, status')
        .eq('account_id', accountId),
      this.supabase
        .from('campaign_emails')
        .select('opens, clicks')
        .eq('account_id', accountId),
    ]);

    const campaigns = campaignsResult.data || [];
    const emails = emailsResult.data || [];

    const totalOpens = emails.reduce((sum: number, email: any) => sum + (email.opens || 0), 0);
    const totalClicks = emails.reduce((sum: number, email: any) => sum + (email.clicks || 0), 0);

    return {
      totalCampaigns: campaigns.length,
      activeCampaigns: campaigns.filter((c: any) => c.status === 'active').length,
      totalEmailsSent: emails.length,
      totalOpens,
      totalClicks,
    };
  }
}
