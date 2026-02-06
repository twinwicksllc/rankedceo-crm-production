import { createClient } from '@/lib/supabase/server';
import type {
  Commission,
  CommissionWithDetails,
  CommissionRate,
  CreateCommissionInput,
  UpdateCommissionInput,
  CreateCommissionRateInput,
  UpdateCommissionRateInput,
  CommissionStats,
  UserCommissionStats,
  CommissionFilters,
} from '@/lib/types/commission';

export class CommissionService {
  private async getUserInfo() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    return { user, account_id: userData.account_id };
  }

  // Commission CRUD operations
  async getCommissions(filters?: CommissionFilters): Promise<CommissionWithDetails[]> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    let query = supabase
      .from('commissions')
      .select(`
        *,
        deal:deals(
          id,
          title,
          stage,
          contact:contacts(name),
          company:companies(name)
        ),
        user:users(
          id,
          name,
          email
        )
      `)
      .eq('account_id', account_id)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.user_id) {
      query = query.eq('user_id', filters.user_id);
    }

    if (filters?.deal_id) {
      query = query.eq('deal_id', filters.deal_id);
    }

    if (filters?.start_date) {
      query = query.gte('created_at', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('created_at', filters.end_date);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch commissions: ${error.message}`);
    }

    return data || [];
  }

  async getCommission(id: string): Promise<CommissionWithDetails | null> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commissions')
      .select(`
        *,
        deal:deals(
          id,
          title,
          stage,
          value,
          contact:contacts(name),
          company:companies(name)
        ),
        user:users(
          id,
          name,
          email
        )
      `)
      .eq('id', id)
      .eq('account_id', account_id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch commission: ${error.message}`);
    }

    return data;
  }

  async createCommission(input: CreateCommissionInput): Promise<Commission> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commissions')
      .insert({
        ...input,
        account_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create commission: ${error.message}`);
    }

    return data;
  }

  async updateCommission(id: string, input: UpdateCommissionInput): Promise<Commission> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commissions')
      .update(input)
      .eq('id', id)
      .eq('account_id', account_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update commission: ${error.message}`);
    }

    return data;
  }

  async deleteCommission(id: string): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from('commissions')
      .delete()
      .eq('id', id)
      .eq('account_id', account_id);

    if (error) {
      throw new Error(`Failed to delete commission: ${error.message}`);
    }
  }

  // Commission Rate CRUD operations
  async getCommissionRates(userId?: string): Promise<CommissionRate[]> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    let query = supabase
      .from('commission_rates')
      .select('*')
      .eq('account_id', account_id)
      .order('effective_from', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch commission rates: ${error.message}`);
    }

    return data || [];
  }

  async getCommissionRate(id: string): Promise<CommissionRate | null> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .eq('id', id)
      .eq('account_id', account_id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch commission rate: ${error.message}`);
    }

    return data;
  }

  async getActiveCommissionRate(userId: string): Promise<CommissionRate | null> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('commission_rates')
      .select('*')
      .eq('account_id', account_id)
      .eq('user_id', userId)
      .eq('is_active', true)
      .lte('effective_from', today)
      .or(`effective_to.is.null,effective_to.gte.${today}`)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to fetch active commission rate: ${error.message}`);
    }

    return data || null;
  }

  async createCommissionRate(input: CreateCommissionRateInput): Promise<CommissionRate> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commission_rates')
      .insert({
        ...input,
        account_id,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create commission rate: ${error.message}`);
    }

    return data;
  }

  async updateCommissionRate(id: string, input: UpdateCommissionRateInput): Promise<CommissionRate> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commission_rates')
      .update(input)
      .eq('id', id)
      .eq('account_id', account_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update commission rate: ${error.message}`);
    }

    return data;
  }

  async deleteCommissionRate(id: string): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from('commission_rates')
      .delete()
      .eq('id', id)
      .eq('account_id', account_id);

    if (error) {
      throw new Error(`Failed to delete commission rate: ${error.message}`);
    }
  }

  // Statistics and Reports
  async getCommissionStats(): Promise<CommissionStats> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commissions')
      .select('status, amount')
      .eq('account_id', account_id);

    if (error) {
      throw new Error(`Failed to fetch commission stats: ${error.message}`);
    }

    const stats: CommissionStats = {
      total_pending: 0,
      total_approved: 0,
      total_paid: 0,
      total_cancelled: 0,
      pending_amount: 0,
      approved_amount: 0,
      paid_amount: 0,
      total_commissions: data?.length || 0,
    };

    data?.forEach((commission) => {
      switch (commission.status) {
        case 'pending':
          stats.total_pending++;
          stats.pending_amount += Number(commission.amount);
          break;
        case 'approved':
          stats.total_approved++;
          stats.approved_amount += Number(commission.amount);
          break;
        case 'paid':
          stats.total_paid++;
          stats.paid_amount += Number(commission.amount);
          break;
        case 'cancelled':
          stats.total_cancelled++;
          break;
      }
    });

    return stats;
  }

  async getUserCommissionStats(): Promise<UserCommissionStats[]> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('commissions')
      .select(`
        user_id,
        amount,
        status,
        rate,
        user:users(
          id,
          name,
          email
        )
      `)
      .eq('account_id', account_id);

    if (error) {
      throw new Error(`Failed to fetch user commission stats: ${error.message}`);
    }

    // Group by user
    const userStatsMap = new Map<string, UserCommissionStats>();

    data?.forEach((commission: any) => {
      const userId = commission.user_id;
      
      if (!userStatsMap.has(userId)) {
        userStatsMap.set(userId, {
          user_id: userId,
          user_name: commission.user?.name || 'Unknown',
          user_email: commission.user?.email || '',
          total_commissions: 0,
          total_amount: 0,
          pending_amount: 0,
          paid_amount: 0,
          commission_count: 0,
          average_rate: 0,
        });
      }

      const stats = userStatsMap.get(userId)!;
      stats.commission_count++;
      stats.total_amount += Number(commission.amount);
      stats.total_commissions += Number(commission.rate);

      if (commission.status === 'pending') {
        stats.pending_amount += Number(commission.amount);
      } else if (commission.status === 'paid') {
        stats.paid_amount += Number(commission.amount);
      }
    });

    // Calculate average rates
    const userStats = Array.from(userStatsMap.values());
    userStats.forEach((stats) => {
      stats.average_rate = stats.commission_count > 0
        ? stats.total_commissions / stats.commission_count
        : 0;
    });

    return userStats.sort((a, b) => b.total_amount - a.total_amount);
  }
}