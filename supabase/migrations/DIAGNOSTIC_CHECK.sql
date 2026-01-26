-- Diagnostic check to identify which table is missing the status column
-- Run this BEFORE the consolidated migration to see what's wrong

-- First, let's check what tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check accounts table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'accounts' 
ORDER BY ordinal_position;

-- Check if there are any existing policies referencing status
SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname LIKE '%status%';

-- Check if there are any triggers referencing status
SELECT trigger_name, event_object_table, action_statement
FROM information_schema.triggers
WHERE action_statement LIKE '%status%';