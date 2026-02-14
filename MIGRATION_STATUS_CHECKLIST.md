# Migration Status Checklist

Based on the conversation history and current codebase, here's the status of all database migrations:

## ✅ Already Applied (According to History)
These migrations were confirmed as applied during previous sessions:

1. **000007_correct_link_auth_users.sql** - Links Supabase Auth users to users table by email
2. **000016_apply_rls_to_lead_tables.sql** - RLS for lead_sources and qualified_leads_global
3. **000017_apply_rls_to_all_remaining_tables.sql** - RLS for contacts, companies, deals, pipelines, lead_assignments

## 🔴 CRITICAL - Must Be Applied
These migrations are essential for the application to function properly:

### 1. Commission Tracking (Phase 12)
**File:** `supabase/migrations/20240116000004_create_commissions.sql`
**Purpose:** Creates commission_rates and commissions tables with automatic calculation
**Features:**
- `commission_rates` table - Store commission rates per user
- `commissions` table - Track earned commissions
- Auto-calculate commission when deal is won
- Update commission when deal value changes
- RLS policies for multi-tenant isolation

**Why Critical:** The Commissions page (`/commissions`) will fail without these tables.

### 2. Onboarding Fields (Phase 13)
**File:** `supabase/migrations/20240116000005_add_onboarding_fields.sql`
**Purpose:** Adds onboarding tracking fields to accounts table
**Features:**
- `onboarding_completed`, `onboarding_step`, `onboarding_skipped` fields
- Company info fields: `company_size`, `industry`, `website`, `phone`, `address`
- Functions: `complete_onboarding()`, `update_onboarding_step()`, `skip_onboarding()`

**Why Critical:** The onboarding wizard (`/onboarding`) requires these fields and functions.

### 3. Company Info Update Function (Phase 13)
**File:** `supabase/migrations/20240116000006_add_update_company_info_function.sql`
**Purpose:** SECURITY DEFINER functions to update account info during onboarding
**Features:**
- `update_company_info()` - Updates company details bypassing RLS
- `update_preferences()` - Updates timezone and settings bypassing RLS

**Why Critical:** Without these functions, the onboarding form submissions will fail with RLS errors.

## ⚠️ Likely Already Applied (Core Features)
These migrations create tables for features that are working in production:

### Activities Module (Phase 7)
**File:** `supabase/migrations/20240116000000_create_activities.sql`
**Status:** Likely applied (activities page is working)

### Campaigns Module (Phase 8)
**File:** `supabase/migrations/20240116000001_create_campaigns.sql`
**Status:** Likely applied (campaigns page is working)

### Email Messages (Phase 9)
**File:** `supabase/migrations/20240116000002_create_email_messages.sql`
**Status:** Likely applied (emails page is working)

### Forms Module (Phase 10)
**File:** `supabase/migrations/20240116000003_create_forms.sql`
**Status:** Likely applied (forms page is working)

## 📋 Optional/Diagnostic Migrations
These are helper migrations for troubleshooting:

- `000002_check_database_state.sql` - Diagnostic queries
- `000004_check_accounts_schema.sql` - Schema verification
- `000010_check_table_columns.sql` - Column verification
- `DIAGNOSTIC_CHECK.sql` - Comprehensive diagnostic

## 🗑️ Deprecated/Superseded Migrations
These were intermediate attempts and are no longer needed:

- `000001_create_users_and_accounts.sql` - Superseded by 000007
- `000003_safe_create_users_accounts.sql` - Superseded by 000007
- `000005_fix_users_accounts_with_correct_schema.sql` - Superseded by 000007
- `000006_link_auth_users_to_existing_users.sql` - Superseded by 000007
- `000008_fix_users_policies.sql` - Superseded by later fixes
- `000009_fix_users_policies_v2.sql` - Superseded by later fixes
- `000011_fix_form_submissions_account_id.sql` - Superseded by 000017
- `000012_fix_recursion_final.sql` - Superseded by 000013
- `000013_complete_rls_fix.sql` - Superseded by 000014
- `000014_safe_rls_fix.sql` - Superseded by 000015-000017
- `000015_apply_rls_to_email_tables.sql` - Included in 000017
- `003_ai_predictive_analytics.sql` - AI features not yet implemented
- `004_optimize_rls_performance.sql` - Performance optimization (optional)
- `CONSOLIDATED_MIGRATION.sql` - Superseded by individual migrations
- `CONSOLIDATED_MIGRATION_SAFE.sql` - Superseded by individual migrations

## 🎯 Action Required

### To verify what's already applied:
Run this query in Supabase SQL Editor:
```sql
-- Check if commission tables exist
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'commissions'
) as commissions_exists,
EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'commission_rates'
) as commission_rates_exists;

-- Check if onboarding fields exist
SELECT column_name 
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name = 'accounts' 
AND column_name IN ('onboarding_completed', 'onboarding_step', 'company_size', 'industry');

-- Check if onboarding functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('complete_onboarding', 'update_onboarding_step', 'update_company_info', 'update_preferences');
```

### To apply the critical migrations:
1. Go to Supabase Dashboard → SQL Editor
2. Run the verification query above to see what's missing
3. Apply migrations in this order:
   - `20240116000004_create_commissions.sql` (if commissions tables don't exist)
   - `20240116000005_add_onboarding_fields.sql` (if onboarding fields don't exist)
   - `20240116000006_add_update_company_info_function.sql` (if functions don't exist)

## 📊 Expected Results After Applying

Once all critical migrations are applied:
- ✅ Commissions page will show commission tracking
- ✅ Onboarding wizard will work for new users
- ✅ Company info can be updated during onboarding
- ✅ All RLS policies will function correctly
- ✅ No 500 errors on form submissions

## 🔍 How to Test

After applying migrations:
1. **Test Commissions:** Create a deal and mark it as "won" - should auto-create commission
2. **Test Onboarding:** Create new account and go through onboarding wizard
3. **Test Company Info:** Update company details in onboarding step 2
4. **Test Preferences:** Update timezone and settings in onboarding step 3

---

**Last Updated:** Based on conversation history through Phase 15 completion
**Production URL:** https://crm.rankedceo.com
**Repository:** https://github.com/twinwicksllc/rankedceo-crm-production