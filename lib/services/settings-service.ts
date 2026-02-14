import { createClient } from '@/lib/supabase/server';
import type { UserProfile, AccountSettings, TeamMember } from '@/lib/types/settings';

export class SettingsService {
  private async getUserInfo() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('Not authenticated');
    }

    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id, id')
      .eq('email', user.email)
      .single();

    if (userError || !userData) {
      throw new Error('User not found');
    }

    return { user, account_id: userData.account_id, user_id: userData.id };
  }

  // User Profile
  async getUserProfile(): Promise<UserProfile | null> {
    const supabase = await createClient();
    const { user } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, avatar_url, role, phone, title')
      .eq('email', user.email)
      .single();

    if (error) {
      throw new Error(`Failed to fetch user profile: ${error.message}`);
    }

    return data;
  }

  async updateUserProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const supabase = await createClient();
    const { user } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('email', user.email)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`);
    }

    return data;
  }

  // Account Settings
  async getAccountSettings(): Promise<AccountSettings | null> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('accounts')
      .select('*')
      .eq('id', account_id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch account settings: ${error.message}`);
    }

    return data;
  }

  async updateAccountSettings(updates: Partial<AccountSettings>): Promise<AccountSettings> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('accounts')
      .update(updates)
      .eq('id', account_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update account settings: ${error.message}`);
    }

    return data;
  }

  // Team Management
  async getTeamMembers(): Promise<TeamMember[]> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, status, avatar_url, last_login_at, created_at')
      .eq('account_id', account_id)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch team members: ${error.message}`);
    }

    return data || [];
  }

  async updateTeamMember(userId: string, updates: Partial<TeamMember>): Promise<TeamMember> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .eq('account_id', account_id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update team member: ${error.message}`);
    }

    return data;
  }

  async removeTeamMember(userId: string): Promise<void> {
    const supabase = await createClient();
    const { account_id } = await this.getUserInfo();

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('account_id', account_id);

    if (error) {
      throw new Error(`Failed to remove team member: ${error.message}`);
    }
  }
}