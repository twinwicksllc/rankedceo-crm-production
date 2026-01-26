# How to Get Your Current Database Schema

## Option 1: Run a Schema Dump Script (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your "RankedCEO CRM" project
3. Click on "SQL Editor" in the left sidebar
4. Click "New Query"

5. Copy and paste this script:

```sql
-- ============================================================================
-- Complete Database Schema Dump for Users and Accounts Tables
-- ============================================================================

-- 1. Accounts Table Schema
SELECT 
    'accounts_table_schema' as section,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'accounts'
ORDER BY ordinal_position;

-- 2. Users Table Schema
SELECT 
    'users_table_schema' as section,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'users'
ORDER BY ordinal_position;

-- 3. Accounts Table Constraints
SELECT 
    'accounts_constraints' as section,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.accounts'::regclass
ORDER BY conname;

-- 4. Users Table Constraints
SELECT 
    'users_constraints' as section,
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.users'::regclass
ORDER BY conname;

-- 5. Accounts Table Indexes
SELECT 
    'accounts_indexes' as section,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'accounts'
ORDER BY indexname;

-- 6. Users Table Indexes
SELECT 
    'users_indexes' as section,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename = 'users'
ORDER BY indexname;

-- 7. Existing RLS Policies on Accounts
SELECT 
    'accounts_policies' as section,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'accounts'
ORDER BY policyname;

-- 8. Existing RLS Policies on Users
SELECT 
    'users_policies' as section,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 9. Existing Triggers
SELECT 
    'triggers' as section,
    trigger_name,
    event_object_table,
    action_statement,
    action_timing,
    event_manipulation
FROM information_schema.triggers
WHERE event_object_table IN ('users', 'accounts')
ORDER BY event_object_table, trigger_name;

-- 10. Sample Data from Accounts (first row)
SELECT 
    'accounts_sample' as section,
    *
FROM accounts
LIMIT 1;

-- 11. Sample Data from Users (first row)
SELECT 
    'users_sample' as section,
    *
FROM users
LIMIT 1;
```

6. Run the script (click "Run" or press Ctrl+Enter)
7. Copy all the results from all the tables
8. Paste them in the chat

## What I Need From You

Please share the results from running the script above. I need to see:
- The exact column names and data types
- Constraints (NOT NULL, DEFAULT values, etc.)
- Existing RLS policies
- Existing triggers
- Sample data

Once I have this information, I can create a migration that matches your database perfectly!