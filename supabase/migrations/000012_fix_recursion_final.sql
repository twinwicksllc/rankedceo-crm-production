-- ============================================================================
-- Final Fix: Disable RLS on users table and use different approach
-- ============================================================================
-- The issue is that even SECURITY DEFINER functions are triggering RLS
-- Solution: Temporarily disable RLS on users table for the lookup function

-- Drop the problematic functions
DROP FUNCTION IF EXISTS get_current_user_email();
DROP FUNCTION IF EXISTS get_current_user_account_id();

-- Create a new function that explicitly disables RLS during execution
CREATE OR REPLACE FUNCTION get_current_user_account_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_account_id UUID;
BEGIN
  -- Disable RLS for this function execution
  SET LOCAL row_security = off;
  
  -- Get the account_id
  SELECT account_id INTO user_account_id
  FROM users
  WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
  LIMIT 1;
  
  RETURN user_account_id;
END;
$$;

-- Now completely drop and recreate users table policies with simpler approach
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
DROP POLICY IF EXISTS "Allow system inserts for users" ON users;
DROP POLICY IF EXISTS "Allow system deletes for users" ON users;

-- Disable RLS on users table entirely
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS but with permissive policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create simple policies that don't cause recursion
CREATE POLICY "Users can view all user records"
    ON users FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    TO authenticated
    USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Allow system inserts for users"
    ON users FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow system deletes for users"
    ON users FOR DELETE
    TO authenticated
    USING (true);

-- Update accounts policies to use the fixed function
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;

CREATE POLICY "Users can view their own account"
    ON accounts FOR SELECT
    TO authenticated
    USING (id = get_current_user_account_id());

CREATE POLICY "Users can update their own account"
    ON accounts FOR UPDATE
    TO authenticated
    USING (id = get_current_user_account_id());

-- Update all other table policies to use the fixed function
DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
CREATE POLICY "Users can view contacts in their account"
    ON contacts FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
CREATE POLICY "Users can insert contacts in their account"
    ON contacts FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
CREATE POLICY "Users can update contacts in their account"
    ON contacts FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;
CREATE POLICY "Users can delete contacts in their account"
    ON contacts FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
CREATE POLICY "Users can view companies in their account"
    ON companies FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
CREATE POLICY "Users can insert companies in their account"
    ON companies FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
CREATE POLICY "Users can update companies in their account"
    ON companies FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;
CREATE POLICY "Users can delete companies in their account"
    ON companies FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
CREATE POLICY "Users can view deals in their account"
    ON deals FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
CREATE POLICY "Users can insert deals in their account"
    ON deals FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
CREATE POLICY "Users can update deals in their account"
    ON deals FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;
CREATE POLICY "Users can delete deals in their account"
    ON deals FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
CREATE POLICY "Users can view pipelines in their account"
    ON pipelines FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
CREATE POLICY "Users can insert pipelines in their account"
    ON pipelines FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
CREATE POLICY "Users can update pipelines in their account"
    ON pipelines FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;
CREATE POLICY "Users can delete pipelines in their account"
    ON pipelines FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view activities in their account" ON activities;
CREATE POLICY "Users can view activities in their account"
    ON activities FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert activities in their account" ON activities;
CREATE POLICY "Users can insert activities in their account"
    ON activities FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update activities in their account" ON activities;
CREATE POLICY "Users can update activities in their account"
    ON activities FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete activities in their account" ON activities;
CREATE POLICY "Users can delete activities in their account"
    ON activities FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view their account's campaigns" ON campaigns;
CREATE POLICY "Users can view their account's campaigns"
    ON campaigns FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert campaigns for their account" ON campaigns;
CREATE POLICY "Users can insert campaigns for their account"
    ON campaigns FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update their account's campaigns" ON campaigns;
CREATE POLICY "Users can update their account's campaigns"
    ON campaigns FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's campaigns" ON campaigns;
CREATE POLICY "Users can delete their account's campaigns"
    ON campaigns FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view their account's email templates" ON email_templates;
CREATE POLICY "Users can view their account's email templates"
    ON email_templates FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert email templates for their account" ON email_templates;
CREATE POLICY "Users can insert email templates for their account"
    ON email_templates FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update their account's email templates" ON email_templates;
CREATE POLICY "Users can update their account's email templates"
    ON email_templates FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's email templates" ON email_templates;
CREATE POLICY "Users can delete their account's email templates"
    ON email_templates FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view their account's forms" ON forms;
CREATE POLICY "Users can view their account's forms"
    ON forms FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert forms for their account" ON forms;
CREATE POLICY "Users can insert forms for their account"
    ON forms FOR INSERT
    TO authenticated
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update their account's forms" ON forms;
CREATE POLICY "Users can update their account's forms"
    ON forms FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's forms" ON forms;
CREATE POLICY "Users can delete their account's forms"
    ON forms FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view their account's form submissions" ON form_submissions;
CREATE POLICY "Users can view their account's form submissions"
    ON form_submissions FOR SELECT
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Anyone can insert form submissions" ON form_submissions;
CREATE POLICY "Anyone can insert form submissions"
    ON form_submissions FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their account's form submissions" ON form_submissions;
CREATE POLICY "Users can update their account's form submissions"
    ON form_submissions FOR UPDATE
    TO authenticated
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's form submissions" ON form_submissions;
CREATE POLICY "Users can delete their account's form submissions"
    ON form_submissions FOR DELETE
    TO authenticated
    USING (account_id = get_current_user_account_id());

-- Add helpful comment
COMMENT ON FUNCTION get_current_user_account_id() IS 'Returns current user account_id with RLS disabled to prevent recursion';