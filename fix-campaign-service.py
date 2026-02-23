import re

with open('lib/services/campaign-service.ts', 'r') as f:
    content = f.read()

# Replace constructor
old_pattern = r'constructor\(\) \{\s*this\.sendGridService = new SendGridService\(process\.env\.SENDGRID_API_KEY \|\| '"'"''"'"'\);\s*this\.supabase = createClient\(\);\s*\}'
new_constructor = '''constructor() {
      this.sendGridService = new SendGridService(process.env.SENDGRID_API_KEY || '');
    // Don't initialize client in constructor - will be lazy-loaded
    this.supabase = null as any;
  }

  private async getClient() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    return this.supabase;
  }'''

content = re.sub(old_pattern, new_constructor, content, flags=re.MULTILINE)

with open('lib/services/campaign-service.ts', 'w') as f:
    f.write(content)

print('✓ Updated campaign-service.ts')