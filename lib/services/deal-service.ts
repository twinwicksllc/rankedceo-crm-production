import { createClient } from '@/lib/supabase/server';
import { Deal, CreateDealInput, UpdateDealInput } from '@/lib/types/deal';
import { createDealSchema, updateDealSchema } from '@/lib/validations/deal';

export class DealService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  async createDeal(input: CreateDealInput): Promise<Deal> {
    const validatedInput = createDealSchema.parse(input);

    const client = await this.supabase;
    
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data: accountData, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountData) {
      throw new Error('Account not found');
    }

    const { data, error } = await client
      .from('deals')
      .insert({
        account_id: accountData.id,
        user_id: user.id,
        ...validatedInput,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create deal: ${error.message}`);
    }

    return data as Deal;
  }

  async getDeals(filters: any = {}): Promise<Deal[]> {
    const client = await this.supabase;
    
    let query = client
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
    }

    if (filters.pipeline_id) {
      query = query.eq('pipeline_id', filters.pipeline_id);
    }

    if (filters.stage) {
      query = query.eq('stage', filters.stage);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch deals: ${error.message}`);
    }

    return data as Deal[];
  }

  async getDealById(id: string): Promise<Deal | null> {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('deals')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch deal: ${error.message}`);
    }

    return data as Deal;
  }

  async updateDeal(id: string, input: UpdateDealInput): Promise<Deal> {
    const validatedInput = updateDealSchema.parse(input);
    const client = await this.supabase;

    const { data, error } = await client
      .from('deals')
      .update(validatedInput)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update deal: ${error.message}`);
    }

    return data as Deal;
  }

  async deleteDeal(id: string): Promise<void> {
    const client = await this.supabase;
    
    const { error } = await client
      .from('deals')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete deal: ${error.message}`);
    }
  }

  async getDealStats() {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('deals')
      .select('*');

    if (error) {
      throw new Error(`Failed to fetch deal stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      totalValue: 0,
      wonCount: 0,
      wonValue: 0,
      lostCount: 0,
      activeCount: 0,
    };

    data?.forEach(deal => {
      stats.totalValue += deal.value || 0;
      
      if (deal.stage === 'Won') {
        stats.wonCount++;
        stats.wonValue += deal.value || 0;
      } else if (deal.stage === 'Lost') {
        stats.lostCount++;
      } else {
        stats.activeCount++;
      }
    });

    stats.totalValue = Math.round(stats.totalValue);
    stats.wonValue = Math.round(stats.wonValue);

    return stats;
  }
}

export const dealService = new DealService();