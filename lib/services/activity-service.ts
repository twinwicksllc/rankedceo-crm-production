import { createClient } from '@/lib/supabase/server';
import { Activity, ActivityWithRelations, CreateActivityInput, UpdateActivityInput, ActivityFilters, ActivityType, ActivityStatus } from '@/lib/types/activity';
import { createActivitySchema, updateActivitySchema, activityFiltersSchema } from '@/lib/validations/activity';
import { z } from 'zod';

export class ActivityService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Create a new activity
   */
  async createActivity(input: CreateActivityInput): Promise<Activity> {
    // Validate input
    const validatedInput = createActivitySchema.parse(input);

    const client = await this.supabase;
    
    // Get current account
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get user's account
    const { data: accountData, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountData) {
      throw new Error('Account not found');
    }

    // Create activity
    const { data, error } = await client
      .from('activities')
      .insert({
        account_id: accountData.id,
        user_id: user.id,
        ...validatedInput,
        completed_at: validatedInput.status === 'completed' ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create activity: ${error.message}`);
    }

    return data as Activity;
  }

  /**
   * Get activities with filters
   */
  async getActivities(filters: ActivityFilters = {}): Promise<ActivityWithRelations[]> {
    const validatedFilters = activityFiltersSchema.parse(filters);
    const client = await this.supabase;

    let query = client
      .from('activities')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email),
        company:companies(id, name),
        deal:deals(id, title)
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (validatedFilters.type) {
      query = query.eq('type', validatedFilters.type);
    }

    if (validatedFilters.status) {
      query = query.eq('status', validatedFilters.status);
    }

    if (validatedFilters.contact_id) {
      query = query.eq('contact_id', validatedFilters.contact_id);
    }

    if (validatedFilters.company_id) {
      query = query.eq('company_id', validatedFilters.company_id);
    }

    if (validatedFilters.deal_id) {
      query = query.eq('deal_id', validatedFilters.deal_id);
    }

    if (validatedFilters.date_from) {
      query = query.gte('created_at', validatedFilters.date_from);
    }

    if (validatedFilters.date_to) {
      query = query.lte('created_at', validatedFilters.date_to);
    }

    if (validatedFilters.search) {
      query = query.or(`title.ilike.%${validatedFilters.search}%,description.ilike.%${validatedFilters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch activities: ${error.message}`);
    }

    return data as ActivityWithRelations[];
  }

  /**
   * Get a single activity by ID
   */
  async getActivityById(id: string): Promise<ActivityWithRelations | null> {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('activities')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email),
        company:companies(id, name),
        deal:deals(id, title)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch activity: ${error.message}`);
    }

    return data as ActivityWithRelations;
  }

  /**
   * Get activities by contact ID
   */
  async getActivitiesByContact(contactId: string): Promise<ActivityWithRelations[]> {
    return this.getActivities({ contact_id: contactId });
  }

  /**
   * Get activities by company ID
   */
  async getActivitiesByCompany(companyId: string): Promise<ActivityWithRelations[]> {
    return this.getActivities({ company_id: companyId });
  }

  /**
   * Get activities by deal ID
   */
  async getActivitiesByDeal(dealId: string): Promise<ActivityWithRelations[]> {
    return this.getActivities({ deal_id: dealId });
  }

  /**
   * Update an activity
   */
  async updateActivity(id: string, input: UpdateActivityInput): Promise<Activity> {
    // Validate input
    const validatedInput = updateActivitySchema.parse(input);

    // If status is being changed to completed, set completed_at
    if (validatedInput.status === 'completed' && !validatedInput.completed_at) {
      validatedInput.completed_at = new Date().toISOString();
    }

    const client = await this.supabase;
    
    const { data, error } = await client
      .from('activities')
      .update(validatedInput)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update activity: ${error.message}`);
    }

    return data as Activity;
  }

  /**
   * Delete an activity
   */
  async deleteActivity(id: string): Promise<void> {
    const client = await this.supabase;
    
    const { error } = await client
      .from('activities')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete activity: ${error.message}`);
    }
  }

  /**
   * Get activity statistics
   */
  async getActivityStats() {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('activities')
      .select('type, status');

    if (error) {
      throw new Error(`Failed to fetch activity stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      byType: {} as Record<ActivityType, number>,
      byStatus: {} as Record<ActivityStatus, number>,
      pending: 0,
      completed: 0,
    };

    data?.forEach(activity => {
      // Count by type
      const type = activity.type as ActivityType;
      if (!stats.byType[type]) {
        stats.byType[type] = 0;
      }
      stats.byType[type]++;

      // Count by status
      const status = activity.status as ActivityStatus;
      if (!stats.byStatus[status]) {
        stats.byStatus[status] = 0;
      }
      stats.byStatus[status]++;

      // Count pending tasks
      if (activity.status === 'pending') {
        stats.pending++;
      }
      if (activity.status === 'completed') {
        stats.completed++;
      }
    });

    return stats;
  }

  /**
   * Get upcoming activities (tasks with due dates)
   */
  async getUpcomingActivities(limit: number = 10): Promise<ActivityWithRelations[]> {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('activities')
      .select(`
        *,
        contact:contacts(id, first_name, last_name, email),
        company:companies(id, name),
        deal:deals(id, title)
      `)
      .eq('status', 'pending')
      .is('due_date', 'not.null')
      .gte('due_date', new Date().toISOString())
      .order('due_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch upcoming activities: ${error.message}`);
    }

    return data as ActivityWithRelations[];
  }
}

// Singleton instance
export const activityService = new ActivityService();