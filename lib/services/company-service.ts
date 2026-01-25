import { createClient } from '@/lib/supabase/server';
import { Company, CreateCompanyInput, UpdateCompanyInput } from '@/lib/types/company';
import { createCompanySchema, updateCompanySchema } from '@/lib/validations/company';

export class CompanyService {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  async createCompany(input: CreateCompanyInput): Promise<Company> {
    const validatedInput = createCompanySchema.parse(input);

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
      .from('companies')
      .insert({
        account_id: accountData.id,
        user_id: user.id,
        ...validatedInput,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create company: ${error.message}`);
    }

    return data as Company;
  }

  async getCompanies(filters: any = {}): Promise<Company[]> {
    const client = await this.supabase;
    
    let query = client
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,industry.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch companies: ${error.message}`);
    }

    return data as Company[];
  }

  async getCompanyById(id: string): Promise<Company | null> {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch company: ${error.message}`);
    }

    return data as Company;
  }

  async updateCompany(id: string, input: UpdateCompanyInput): Promise<Company> {
    const validatedInput = updateCompanySchema.parse(input);
    const client = await this.supabase;

    const { data, error } = await client
      .from('companies')
      .update(validatedInput)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }

    return data as Company;
  }

  async deleteCompany(id: string): Promise<void> {
    const client = await this.supabase;
    
    const { error } = await client
      .from('companies')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete company: ${error.message}`);
    }
  }

  async getCompanyStats() {
    const client = await this.supabase;
    
    const { data, error } = await client
      .from('companies')
      .select('status');

    if (error) {
      throw new Error(`Failed to fetch company stats: ${error.message}`);
    }

    const stats = {
      total: data?.length || 0,
      active: 0,
      inactive: 0,
      prospect: 0,
    };

    data?.forEach(company => {
      if (company.status === 'active') stats.active++;
      if (company.status === 'inactive') stats.inactive++;
      if (company.status === 'prospect') stats.prospect++;
    });

    return stats;
  }
}

export const companyService = new CompanyService();