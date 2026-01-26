-- ============================================================================
-- Safe RLS Fix - Only updates tables that exist and have account_id
-- ============================================================================

-- 1. CLEANUP: Drop old functions and policies
DROP FUNCTION IF EXISTS get_current_user_email() CASCADE;
DROP FUNCTION IF EXISTS get_current_user_account_id() CASCADE;

-- 2. THE FIX: Create a high-performance, non-recursive account lookup
CREATE OR REPLACE FUNCTION get_current_user_account_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    user_account_id UUID;
BEGIN
    SET LOCAL row_security = off;
    SELECT account_id INTO user_account_id
    FROM public.users
    WHERE id = auth.uid()
    LIMIT 1;
    RETURN user_account_id;
END;
$$;

-- 3. SECURE USERS TABLE
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view teammates" ON users;
DROP POLICY IF EXISTS "Users can update self" ON users;

CREATE POLICY "Users can view teammates" ON users FOR SELECT 
TO authenticated USING (account_id = get_current_user_account_id());

CREATE POLICY "Users can update self" ON users FOR UPDATE 
TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "Allow system inserts" ON users FOR INSERT 
TO authenticated WITH CHECK (true);

-- 4. SECURE ACCOUNTS TABLE
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
CREATE POLICY "Users can view their own account" ON accounts FOR SELECT 
TO authenticated USING (id = get_current_user_account_id());

-- 5. SECURE CONTACTS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
        DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
        DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
        DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;

        CREATE POLICY "Users can view contacts" ON contacts FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage contacts" ON contacts FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 6. SECURE COMPANIES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
        DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
        DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
        DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;

        CREATE POLICY "Users can view companies" ON companies FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage companies" ON companies FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 7. SECURE DEALS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'deals' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
        DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
        DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
        DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;

        CREATE POLICY "Users can view deals" ON deals FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage deals" ON deals FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 8. SECURE PIPELINES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pipelines' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
        DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
        DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
        DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;

        CREATE POLICY "Users can view pipelines" ON pipelines FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage pipelines" ON pipelines FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 9. SECURE ACTIVITIES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'activities' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view activities in their account" ON activities;
        DROP POLICY IF EXISTS "Users can insert activities in their account" ON activities;
        DROP POLICY IF EXISTS "Users can update activities in their account" ON activities;
        DROP POLICY IF EXISTS "Users can delete activities in their account" ON activities;

        CREATE POLICY "Users can view activities" ON activities FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage activities" ON activities FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 10. SECURE CAMPAIGNS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's campaigns" ON campaigns;
        DROP POLICY IF EXISTS "Users can insert campaigns for their account" ON campaigns;
        DROP POLICY IF EXISTS "Users can update their account's campaigns" ON campaigns;
        DROP POLICY IF EXISTS "Users can delete their account's campaigns" ON campaigns;

        CREATE POLICY "Users can view campaigns" ON campaigns FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage campaigns" ON campaigns FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 11. SECURE EMAIL_TEMPLATES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's email templates" ON email_templates;
        DROP POLICY IF EXISTS "Users can insert email templates for their account" ON email_templates;
        DROP POLICY IF EXISTS "Users can update their account's email templates" ON email_templates;
        DROP POLICY IF EXISTS "Users can delete their account's email templates" ON email_templates;

        CREATE POLICY "Users can view email templates" ON email_templates FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage email templates" ON email_templates FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 12. SECURE FORMS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'forms' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's forms" ON forms;
        DROP POLICY IF EXISTS "Users can insert forms for their account" ON forms;
        DROP POLICY IF EXISTS "Users can update their account's forms" ON forms;
        DROP POLICY IF EXISTS "Users can delete their account's forms" ON forms;

        CREATE POLICY "Users can view forms" ON forms FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage forms" ON forms FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 13. SECURE FORM_SUBMISSIONS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'form_submissions' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's form submissions" ON form_submissions;
        DROP POLICY IF EXISTS "Anyone can insert form submissions" ON form_submissions;
        DROP POLICY IF EXISTS "Users can update their account's form submissions" ON form_submissions;
        DROP POLICY IF EXISTS "Users can delete their account's form submissions" ON form_submissions;

        CREATE POLICY "Users can view form submissions" ON form_submissions FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage form submissions" ON form_submissions FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Public can insert form submissions" ON form_submissions FOR INSERT 
        WITH CHECK (true);
    END IF;
END $$;

-- 14. SECURE EMAIL_THREADS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_threads' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's email threads" ON email_threads;
        DROP POLICY IF EXISTS "Users can insert email threads for their account" ON email_threads;
        DROP POLICY IF EXISTS "Users can update their account's email threads" ON email_threads;
        DROP POLICY IF EXISTS "Users can delete their account's email threads" ON email_threads;

        CREATE POLICY "Users can view email threads" ON email_threads FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage email threads" ON email_threads FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 15. SECURE EMAIL_MESSAGES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_messages' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's email messages" ON email_messages;
        DROP POLICY IF EXISTS "Users can insert email messages for their account" ON email_messages;
        DROP POLICY IF EXISTS "Users can update their account's email messages" ON email_messages;
        DROP POLICY IF EXISTS "Users can delete their account's email messages" ON email_messages;

        CREATE POLICY "Users can view email messages" ON email_messages FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage email messages" ON email_messages FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 16. SECURE CAMPAIGN_EMAILS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_emails' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's campaign emails" ON campaign_emails;
        DROP POLICY IF EXISTS "Users can insert campaign emails for their account" ON campaign_emails;
        DROP POLICY IF EXISTS "Users can update their account's campaign emails" ON campaign_emails;
        DROP POLICY IF EXISTS "Users can delete their account's campaign emails" ON campaign_emails;

        CREATE POLICY "Users can view campaign emails" ON campaign_emails FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage campaign emails" ON campaign_emails FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 17. SECURE CAMPAIGN_SEQUENCES TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_sequences' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view sequences for their account's campaigns" ON campaign_sequences;
        DROP POLICY IF EXISTS "Users can insert sequences for their account's campaigns" ON campaign_sequences;
        DROP POLICY IF EXISTS "Users can update sequences for their account's campaigns" ON campaign_sequences;
        DROP POLICY IF EXISTS "Users can delete sequences for their account's campaigns" ON campaign_sequences;

        CREATE POLICY "Users can view campaign sequences" ON campaign_sequences FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage campaign sequences" ON campaign_sequences FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 18. SECURE CAMPAIGN_SEQUENCE_EXECUTIONS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaign_sequence_executions' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view executions for their account's campaigns" ON campaign_sequence_executions;
        DROP POLICY IF EXISTS "Users can insert executions for their account's campaigns" ON campaign_sequence_executions;
        DROP POLICY IF EXISTS "Users can update executions for their account's campaigns" ON campaign_sequence_executions;
        DROP POLICY IF EXISTS "Users can delete executions for their account's campaigns" ON campaign_sequence_executions;

        CREATE POLICY "Users can view campaign sequence executions" ON campaign_sequence_executions FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage campaign sequence executions" ON campaign_sequence_executions FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 19. SECURE CAMPAIGN_ANALYTICS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_analytics') THEN
        DROP POLICY IF EXISTS "Users can view analytics for their account's campaigns" ON campaign_analytics;

        CREATE POLICY "Users can view campaign analytics" ON campaign_analytics FOR SELECT 
        TO authenticated USING (campaign_id IN (SELECT id FROM campaigns WHERE account_id = get_current_user_account_id()));
    END IF;
END $$;

-- 20. SECURE AI TABLES
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_scoring_history' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's AI scoring history" ON ai_scoring_history;
        DROP POLICY IF EXISTS "Users can insert AI scoring history for their account" ON ai_scoring_history;

        CREATE POLICY "Users can view AI scoring history" ON ai_scoring_history FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage AI scoring history" ON ai_scoring_history FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_model_performance' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's AI model performance" ON ai_model_performance;
        DROP POLICY IF EXISTS "Users can insert AI model performance for their account" ON ai_model_performance;
        DROP POLICY IF EXISTS "Users can update their account's AI model performance" ON ai_model_performance;

        CREATE POLICY "Users can view AI model performance" ON ai_model_performance FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage AI model performance" ON ai_model_performance FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ai_insights' AND column_name = 'account_id') THEN
        DROP POLICY IF EXISTS "Users can view their account's AI insights" ON ai_insights;
        DROP POLICY IF EXISTS "Users can insert AI insights for their account" ON ai_insights;
        DROP POLICY IF EXISTS "Users can update their account's AI insights" ON ai_insights;
        DROP POLICY IF EXISTS "Users can delete their account's AI insights" ON ai_insights;

        CREATE POLICY "Users can view AI insights" ON ai_insights FOR SELECT 
        TO authenticated USING (account_id = get_current_user_account_id());

        CREATE POLICY "Users can manage AI insights" ON ai_insights FOR ALL 
        TO authenticated USING (account_id = get_current_user_account_id());
    END IF;
END $$;

-- 21. SECURE FORM_FIELDS TABLE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'form_fields') THEN
        DROP POLICY IF EXISTS "Users can view fields for their account's forms" ON form_fields;
        DROP POLICY IF EXISTS "Users can insert fields for their account's forms" ON form_fields;
        DROP POLICY IF EXISTS "Users can update fields for their account's forms" ON form_fields;
        DROP POLICY IF EXISTS "Users can delete fields for their account's forms" ON form_fields;

        CREATE POLICY "Users can view form fields" ON form_fields FOR SELECT 
        TO authenticated USING (form_id IN (SELECT id FROM forms WHERE account_id = get_current_user_account_id()));

        CREATE POLICY "Users can manage form fields" ON form_fields FOR ALL 
        TO authenticated USING (form_id IN (SELECT id FROM forms WHERE account_id = get_current_user_account_id()));
    END IF;
END $$;

-- Add helpful comment
COMMENT ON FUNCTION get_current_user_account_id() IS 'Secure, non-recursive account lookup with RLS bypass. SECURITY DEFINER, search_path pinned to public for security.';