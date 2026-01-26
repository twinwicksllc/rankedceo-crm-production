-- Migration: Check Current Database State
-- Description: Diagnostic script to verify what tables and policies exist

-- Check if accounts table exists
SELECT 
    'accounts_table' as item,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'accounts'
    ) as exists;

-- Check if users table exists
SELECT 
    'users_table' as item,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
    ) as exists;

-- Check existing RLS policies on users table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- Check existing RLS policies on accounts table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'accounts'
ORDER BY policyname;

-- Check triggers
SELECT 
    trigger_name,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('users', 'accounts')
ORDER BY event_object_table, trigger_name;