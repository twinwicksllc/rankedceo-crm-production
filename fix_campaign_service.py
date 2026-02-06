import re

# Read the file
with open('/workspace/lib/services/campaign-service.ts', 'r') as f:
    content = f.read()

# Add the helper method after the constructor
helper_method = '''
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
'''

# Insert helper method after constructor
constructor_pattern = r'(constructor\(\) \{[^}]+\}\s+)'
content = re.sub(constructor_pattern, r'\1' + helper_method, content)

# Replace getTemplates method
get_templates_pattern = r'async getTemplates\(search\?: string\): Promise<EmailTemplate\[\]> \{[^}]+\s+const userData = await this\.supabase\.auth\.getUser\(\);[^}]+throw new Error\(.*?\);[^}]+let query = await this\.supabase[^}]+\.eq\(\'account_id\', userData\.data\.user\.user_metadata\.account_id\)[^}]+\s+if \(search\) \{[^}]+\}\s+const \{ data, error \} = await query;[^}]+if \(error\) throw error;[^}]+return data \|\| \[\];[^}]+\}'

new_get_templates = '''async getTemplates(search?: string): Promise<EmailTemplate[]> {
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
  }'''

content = re.sub(get_templates_pattern, new_get_templates, content)

# Write the file
with open('/workspace/lib/services/campaign-service.ts', 'w') as f:
    f.write(content)

print("CampaignService fixed successfully!")