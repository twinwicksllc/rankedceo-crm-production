-- Apply RLS Policies to Email Tables
-- This migration secures the Phase 9 email capture tables with proper multi-tenant isolation

-- Enable RLS and apply policies to email_threads table
ALTER TABLE email_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON email_threads;

CREATE POLICY "Users can view account data" ON email_threads 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON email_threads;

CREATE POLICY "Users can manage account data" ON email_threads 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- Enable RLS and apply policies to email_messages table
ALTER TABLE email_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view account data" ON email_messages;

CREATE POLICY "Users can view account data" ON email_messages 
FOR SELECT TO authenticated 
USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can manage account data" ON email_messages;

CREATE POLICY "Users can manage account data" ON email_messages 
FOR ALL TO authenticated 
USING (account_id = get_current_user_account_id())
WITH CHECK (account_id = get_current_user_account_id());

-- Verification queries
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
WHERE tablename IN ('email_threads', 'email_messages')
ORDER BY tablename, policyname;