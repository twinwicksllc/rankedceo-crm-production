# Dashboard 404 Error - Fix Required

## Issue
The dashboard and other CRM pages are showing 404 errors or not loading properly.

## Root Cause
The `users` and `accounts` tables don't exist in your Supabase database yet. These tables are required for the CRM to function as they link Supabase Auth users to account data.

## Solution

### Step 1: Run the Database Migration

You need to run the `000001_create_users_and_accounts.sql` migration in your Supabase database.

1. Go to https://supabase.com/dashboard
2. Select your "RankedCEO CRM" project
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open the file `supabase/migrations/000001_create_users_and_accounts.sql` from your codebase
6. Copy the entire content
7. Paste it into the SQL Editor
8. Click **Run** (or press Ctrl+Enter)

You should see success messages indicating the tables were created.

### Step 2: Verify the Migration

After running the migration, verify it worked by running this query in the SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'accounts');
```

You should see both `users` and `accounts` listed.

### Step 3: Test the Application

1. Go to https://crm.rankedceo.com
2. Log in with your account
3. Navigate to the Dashboard
4. The dashboard should now load correctly

## What This Migration Does

The migration creates two essential tables:

### `accounts` Table
- Stores account information (account name, created/updated timestamps)
- Each user belongs to one account
- Supports multi-tenancy (multiple users per account)

### `users` Table
- Links Supabase Auth users to accounts
- Stores user profile information (full name, avatar URL)
- Has automatic triggers to create accounts for new signups

### Automatic Features
- **New User Signup**: When a new user signs up, an account is automatically created
- **User-Account Link**: Users are automatically linked to their account
- **Row Level Security**: All data is scoped to the user's account

## Additional Migrations Needed

After fixing the users/accounts issue, you should also run these migrations for full functionality:

### Phase 7: Activities
- File: `supabase/migrations/20240116000000_create_activities.sql`

### Phase 9: Emails
- File: `supabase/migrations/20240116000002_create_email_messages.sql`

### Phase 10: Forms
- File: `supabase/migrations/20240116000003_create_forms.sql`

Run these in the same SQL Editor after the users/accounts migration.

## Settings Page Fixed

I've also added a basic Settings page to fix the 404 error when clicking Settings in the navigation. The settings page has placeholder content that will be fully implemented in Phase 13.

## Why This Happened

The CRM uses a multi-tenant architecture where all data (contacts, companies, deals, activities, emails, forms) is scoped to a user's account. The `users` table is the bridge between Supabase Auth and your account data. Without this table, the application can't determine which account's data to show, resulting in 404 errors.

## Support

If you encounter any issues after running the migration:
1. Check the SQL Editor for any error messages
2. Verify the tables were created using the verification query above
3. Try logging out and logging back in
4. Clear your browser cache and cookies

The migration is safe to run multiple times - it uses `IF NOT EXISTS` statements, so it won't create duplicates if run again.