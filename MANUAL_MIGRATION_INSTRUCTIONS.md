# Manual Database Migration Instructions

## 🚨 Critical: This Migration Must Be Run in Supabase

The `users` and `accounts` tables don't exist in your database, which is why all pages show "no account".

## Steps to Run the Migration

### Step 1: Go to Supabase SQL Editor

1. Go to: https://supabase.com/dashboard
2. Select your project: "RankedCEO CRM"
3. Click on **SQL Editor** in the left sidebar
4. Click **New Query**

### Step 2: Run the Migration Script

Copy and paste the entire content from:
`supabase/migrations/000001_create_users_and_accounts.sql`

Into the SQL Editor and click **Run**.

### Step 3: Verify the Migration

After running the migration, check the results:
- You should see messages like: "Created account and user record for: your@email.com"
- No error messages should appear

### Step 4: Verify Tables Were Created

Run this query to verify:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'accounts');

-- Check if your user has an account
SELECT u.id, u.full_name, u.account_id, a.name as account_name
FROM users u
JOIN accounts a ON u.account_id = a.id
WHERE u.id = auth.uid();
```

### Step 5: Test the Application

After the migration:
1. Go to: https://crm.rankedceo.com
2. Refresh the page
3. You should now see:
   - Dashboard with stats
   - All other pages working
   - No more "no account" errors

## What This Migration Does

1. **Creates `accounts` table** - Stores account information
2. **Creates `users` table** - Links Supabase auth users to accounts
3. **Creates trigger** - Automatically creates account + user when someone signs up
4. **Migrates existing users** - Creates accounts for users who signed up before this migration
5. **Adds RLS policies** - Ensures users can only access their own data

## If You Encounter Errors

### Error: "relation 'users' already exists"
This means the tables were already created. You can skip the migration or delete the tables first.

### Error: "function handle_new_user() already exists"
Run these commands first:
```sql
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

Then run the migration again.

### Error: "permission denied"
Make sure you're running this as the project owner in Supabase.

---

## Need Help?

If you have any issues:
1. Copy the error message
2. Share it with me
3. I'll help you resolve it

---

**IMPORTANT:** Run this migration before testing the application again!