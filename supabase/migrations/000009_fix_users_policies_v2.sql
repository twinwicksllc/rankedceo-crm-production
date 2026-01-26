-- ============================================================================
-- Fix: Completely Rewrite Users RLS Policies to Avoid Recursion
-- ============================================================================
-- Problem: The policies are still causing infinite recursion
-- Solution: Use SECURITY DEFINER functions to bypass RLS during lookup

-- First, create a function that bypasses RLS to get user email
CREATE OR REPLACE FUNCTION get_current_user_email()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid();
$$;

-- Create a function that bypasses RLS to get user account_id
CREATE OR REPLACE FUNCTION get_current_user_account_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
PARALLEL SAFE
AS $$
  SELECT account_id FROM users WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid()) LIMIT 1;
$$;

-- Now drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
DROP POLICY IF EXISTS "Allow system inserts for users" ON users;
DROP POLICY IF EXISTS "Allow system deletes for users" ON users;

-- Create new policies using the security definer functions
CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    USING (email = get_current_user_email());

CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    USING (email = get_current_user_email());

CREATE POLICY "Allow system inserts for users"
    ON users FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow system deletes for users"
    ON users FOR DELETE
    USING (true);

-- Update accounts policies to use the security definer function
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;

CREATE POLICY "Users can view their own account"
    ON accounts FOR SELECT
    USING (id = get_current_user_account_id());

CREATE POLICY "Users can update their own account"
    ON accounts FOR UPDATE
    USING (id = get_current_user_account_id());

-- Also update all other table policies to use the security definer function
-- This ensures consistency and prevents any other recursion issues

DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
CREATE POLICY "Users can view contacts in their account"
    ON contacts FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
CREATE POLICY "Users can insert contacts in their account"
    ON contacts FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
CREATE POLICY "Users can update contacts in their account"
    ON contacts FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;
CREATE POLICY "Users can delete contacts in their account"
    ON contacts FOR DELETE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
CREATE POLICY "Users can view companies in their account"
    ON companies FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
CREATE POLICY "Users can insert companies in their account"
    ON companies FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
CREATE POLICY "Users can update companies in their account"
    ON companies FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;
CREATE POLICY "Users can delete companies in their account"
    ON companies FOR DELETE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
CREATE POLICY "Users can view deals in their account"
    ON deals FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
CREATE POLICY "Users can insert deals in their account"
    ON deals FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
CREATE POLICY "Users can update deals in their account"
    ON deals FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;
CREATE POLICY "Users can delete deals in their account"
    ON deals FOR DELETE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
CREATE POLICY "Users can view pipelines in their account"
    ON pipelines FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
CREATE POLICY "Users can insert pipelines in their account"
    ON pipelines FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
CREATE POLICY "Users can update pipelines in their account"
    ON pipelines FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;
CREATE POLICY "Users can delete pipelines in their account"
    ON pipelines FOR DELETE
    USING (account_id = get_current_user_account_id());

-- Update activities policies
DROP POLICY IF EXISTS "Users can view activities in their account" ON activities;
CREATE POLICY "Users can view activities in their account"
    ON activities FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert activities in their account" ON activities;
CREATE POLICY "Users can insert activities in their account"
    ON activities FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update activities in their account" ON activities;
CREATE POLICY "Users can update activities in their account"
    ON activities FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete activities in their account" ON activities;
CREATE POLICY "Users can delete activities in their account"
    ON activities FOR DELETE
    USING (account_id = get_current_user_account_id());

-- Update campaigns policies
DROP POLICY IF EXISTS "Users can view their account's campaigns" ON campaigns;
CREATE POLICY "Users can view their account's campaigns"
    ON campaigns FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert campaigns for their account" ON campaigns;
CREATE POLICY "Users can insert campaigns for their account"
    ON campaigns FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update their account's campaigns" ON campaigns;
CREATE POLICY "Users can update their account's campaigns"
    ON campaigns FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's campaigns" ON campaigns;
CREATE POLICY "Users can delete their account's campaigns"
    ON campaigns FOR DELETE
    USING (account_id = get_current_user_account_id());

-- Update email_templates policies
DROP POLICY IF EXISTS "Users can view their account's email templates" ON email_templates;
CREATE POLICY "Users can view their account's email templates"
    ON email_templates FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert email templates for their account" ON email_templates;
CREATE POLICY "Users can insert email templates for their account"
    ON email_templates FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update their account's email templates" ON email_templates;
CREATE POLICY "Users can update their account's email templates"
    ON email_templates FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's email templates" ON email_templates;
CREATE POLICY "Users can delete their account's email templates"
    ON email_templates FOR DELETE
    USING (account_id = get_current_user_account_id());

-- Update forms policies
DROP POLICY IF EXISTS "Users can view their account's forms" ON forms;
CREATE POLICY "Users can view their account's forms"
    ON forms FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can insert forms for their account" ON forms;
CREATE POLICY "Users can insert forms for their account"
    ON forms FOR INSERT
    WITH CHECK (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can update their account's forms" ON forms;
CREATE POLICY "Users can update their account's forms"
    ON forms FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's forms" ON forms;
CREATE POLICY "Users can delete their account's forms"
    ON forms FOR DELETE
    USING (account_id = get_current_user_account_id());

-- Update form_submissions policies
DROP POLICY IF EXISTS "Users can view their account's form submissions" ON form_submissions;
CREATE POLICY "Users can view their account's form submissions"
    ON form_submissions FOR SELECT
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Anyone can insert form submissions" ON form_submissions;
CREATE POLICY "Anyone can insert form submissions"
    ON form_submissions FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update their account's form submissions" ON form_submissions;
CREATE POLICY "Users can update their account's form submissions"
    ON form_submissions FOR UPDATE
    USING (account_id = get_current_user_account_id());

DROP POLICY IF EXISTS "Users can delete their account's form submissions" ON form_submissions;
CREATE POLICY "Users can delete their account's form submissions"
    ON form_submissions FOR DELETE
    USING (account_id = get_current_user_account_id());

-- Add helpful comments
COMMENT ON FUNCTION get_current_user_email() IS 'Returns current authenticated user email, bypassing RLS';
COMMENT ON FUNCTION get_current_user_account_id() IS 'Returns current user account_id, bypassing RLS';