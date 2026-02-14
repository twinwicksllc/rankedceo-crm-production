# CRITICAL: Onboarding Migrations Required

## Problem
The onboarding flow is failing because the SECURITY DEFINER functions don't exist in your Supabase database yet. These functions are required to bypass RLS policies during onboarding.

## Solution: Run These 2 Migrations in Order

### Migration 1: Add Onboarding Fields
**File:** `supabase/migrations/20240116000005_add_onboarding_fields.sql`

**What it does:**
- Adds onboarding tracking fields to accounts table
- Creates `update_onboarding_step()` function
- Creates `complete_onboarding()` function
- Creates `skip_onboarding()` function

**How to run:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"
5. Copy the entire contents of `supabase/migrations/20240116000005_add_onboarding_fields.sql`
6. Paste into the editor
7. Click "Run" (or press Ctrl+Enter)
8. Verify you see "Success. No rows returned"

---

### Migration 2: Add Company Info Functions
**File:** `supabase/migrations/20240116000006_add_update_company_info_function.sql`

**What it does:**
- Creates `update_company_info()` function
- Creates `update_preferences()` function

**How to run:**
1. In Supabase SQL Editor, click "New Query"
2. Copy the entire contents of `supabase/migrations/20240116000006_add_update_company_info_function.sql`
3. Paste into the editor
4. Click "Run"
5. Verify you see "Success. No rows returned"

---

## Verification

After running both migrations, verify the functions exist:

```sql
-- Run this query to check if functions were created
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND routine_name IN (
        'update_onboarding_step',
        'complete_onboarding',
        'skip_onboarding',
        'update_company_info',
        'update_preferences'
    )
ORDER BY routine_name;
```

You should see 5 functions listed.

---

## What Happens After Running Migrations

Once both migrations are run:
1. ✅ "Get Started" button will work (uses `update_onboarding_step`)
2. ✅ Company info form will work (uses `update_company_info`)
3. ✅ Team setup will work (just logs, no DB update)
4. ✅ Preferences will work (uses `update_preferences`)
5. ✅ Completion will work (uses `complete_onboarding`)
6. ✅ Skip will work (uses `skip_onboarding`)

---

## Quick Copy-Paste Instructions

### Step 1: Run Migration 20240116000005
```sql
-- Copy from: supabase/migrations/20240116000005_add_onboarding_fields.sql
-- Paste and run in Supabase SQL Editor
```

### Step 2: Run Migration 20240116000006
```sql
-- Copy from: supabase/migrations/20240116000006_add_update_company_info_function.sql
-- Paste and run in Supabase SQL Editor
```

### Step 3: Verify
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE '%onboarding%' OR routine_name LIKE '%company%' OR routine_name LIKE '%preferences%';
```

---

## Why This Is Needed

The application code is calling these functions:
- `supabase.rpc('update_onboarding_step', {...})`
- `supabase.rpc('complete_onboarding', {...})`
- `supabase.rpc('skip_onboarding', {...})`
- `supabase.rpc('update_company_info', {...})`
- `supabase.rpc('update_preferences', {...})`

If these functions don't exist in the database, you'll get 500 errors.

The functions are marked as `SECURITY DEFINER` which means they run with elevated privileges and can bypass Row Level Security (RLS) policies. This is necessary during onboarding because the user needs to update their account record, but RLS policies might block direct updates.

---

## After Running Migrations

Test the onboarding flow:
1. Go to https://crm.rankedceo.com/onboarding
2. Click "Get Started" → Should advance to Company Info
3. Fill out company info → Should advance to Team Setup
4. Skip or add team members → Should advance to Preferences
5. Set preferences → Should advance to Completion
6. Click "Go to Dashboard" → Should redirect to dashboard

All steps should work without 500 errors!
