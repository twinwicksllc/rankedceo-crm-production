-- Migration: Optimize RLS Performance
-- Description: Wrap auth.uid() in SELECT statements to enable initPlan optimization
-- This prevents auth.uid() from being called on every row, dramatically improving performance

-- ============================================================================
-- Drop existing policies to recreate them with optimizations
-- ============================================================================

-- Accounts policies
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;

-- Users policies  
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;

-- Contacts policies
DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;

-- Companies policies
DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;

-- Deals policies
DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;

-- Activities policies
DROP POLICY IF EXISTS "Users can view activities in their account" ON activities;
DROP POLICY IF EXISTS "Users can insert activities in their account" ON activities;
DROP POLICY IF EXISTS "Users can update activities in their account" ON activities;
DROP POLICY IF EXISTS "Users can delete activities in their account" ON activities;

-- Pipelines policies
DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;

-- Pipeline stages policies
DROP POLICY IF EXISTS "Users can view pipeline stages in their account" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can insert pipeline stages in their account" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can update pipeline stages in their account" ON pipeline_stages;
DROP POLICY IF EXISTS "Users can delete pipeline stages in their account" ON pipeline_stages;

-- Campaigns policies
DROP POLICY IF EXISTS "Users can view campaigns in their account" ON campaigns;
DROP POLICY IF EXISTS "Users can insert campaigns in their account" ON campaigns;
DROP POLICY IF EXISTS "Users can update campaigns in their account" ON campaigns;
DROP POLICY IF EXISTS "Users can delete campaigns in their account" ON campaigns;

-- Messages policies
DROP POLICY IF EXISTS "Users can view messages in their account" ON messages;

-- Forms policies
DROP POLICY IF EXISTS "Users can view forms in their account" ON forms;
DROP POLICY IF EXISTS "Users can insert forms in their account" ON forms;
DROP POLICY IF EXISTS "Users can update forms in their account" ON forms;
DROP POLICY IF EXISTS "Users can delete forms in their account" ON forms;

-- AI-related policies
DROP POLICY IF EXISTS "Users can view feature importance for their account" ON feature_importance;
DROP POLICY IF EXISTS "Users can insert feature importance for their account" ON feature_importance;
DROP POLICY IF EXISTS "Users can view model performance for their account" ON model_performance;
DROP POLICY IF EXISTS "Users can insert model performance for their account" ON model_performance;
DROP POLICY IF EXISTS "Users can update model performance for their account" ON model_performance;
DROP POLICY IF EXISTS "Users can view prediction history for their account" ON prediction_history;
DROP POLICY IF EXISTS "Users can insert prediction history for their account" ON prediction_history;
DROP POLICY IF EXISTS "Users can update prediction history for their account" ON prediction_history;
DROP POLICY IF EXISTS "Users can view training jobs for their account" ON training_jobs;
DROP POLICY IF EXISTS "Users can insert training jobs for their account" ON training_jobs;
DROP POLICY IF EXISTS "Users can update training jobs for their account" ON training_jobs;
DROP POLICY IF EXISTS "Users can view model readiness for their account" ON model_readiness;
DROP POLICY IF EXISTS "Users can insert model readiness for their account" ON model_readiness;
DROP POLICY IF EXISTS "Users can update model readiness for their account" ON model_readiness;

-- ============================================================================
-- Recreate policies with optimized auth.uid() wrapped in SELECT
-- ============================================================================

-- Accounts policies
CREATE POLICY "Users can view their own account"
  ON accounts FOR SELECT
  TO authenticated
  USING (id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update their own account"
  ON accounts FOR UPDATE
  TO authenticated
  USING (id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Users policies
CREATE POLICY "Users can view their own user record"
  ON users FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- Contacts policies
CREATE POLICY "Users can view contacts in their account"
  ON contacts FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert contacts in their account"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update contacts in their account"
  ON contacts FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete contacts in their account"
  ON contacts FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Companies policies
CREATE POLICY "Users can view companies in their account"
  ON companies FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert companies in their account"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update companies in their account"
  ON companies FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete companies in their account"
  ON companies FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Deals policies
CREATE POLICY "Users can view deals in their account"
  ON deals FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert deals in their account"
  ON deals FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update deals in their account"
  ON deals FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete deals in their account"
  ON deals FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Activities policies
CREATE POLICY "Users can view activities in their account"
  ON activities FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert activities in their account"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update activities in their account"
  ON activities FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete activities in their account"
  ON activities FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Pipelines policies
CREATE POLICY "Users can view pipelines in their account"
  ON pipelines FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert pipelines in their account"
  ON pipelines FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update pipelines in their account"
  ON pipelines FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete pipelines in their account"
  ON pipelines FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Pipeline stages policies
CREATE POLICY "Users can view pipeline stages in their account"
  ON pipeline_stages FOR SELECT
  TO authenticated
  USING (
    pipeline_id IN (
      SELECT id FROM pipelines 
      WHERE account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Users can insert pipeline stages in their account"
  ON pipeline_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    pipeline_id IN (
      SELECT id FROM pipelines 
      WHERE account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Users can update pipeline stages in their account"
  ON pipeline_stages FOR UPDATE
  TO authenticated
  USING (
    pipeline_id IN (
      SELECT id FROM pipelines 
      WHERE account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    pipeline_id IN (
      SELECT id FROM pipelines 
      WHERE account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Users can delete pipeline stages in their account"
  ON pipeline_stages FOR DELETE
  TO authenticated
  USING (
    pipeline_id IN (
      SELECT id FROM pipelines 
      WHERE account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid()))
    )
  );

-- Campaigns policies
CREATE POLICY "Users can view campaigns in their account"
  ON campaigns FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert campaigns in their account"
  ON campaigns FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update campaigns in their account"
  ON campaigns FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete campaigns in their account"
  ON campaigns FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Messages policies
CREATE POLICY "Users can view messages in their account"
  ON messages FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- Forms policies
CREATE POLICY "Users can view forms in their account"
  ON forms FOR SELECT
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can insert forms in their account"
  ON forms FOR INSERT
  TO authenticated
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can update forms in their account"
  ON forms FOR UPDATE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())))
  WITH CHECK (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

CREATE POLICY "Users can delete forms in their account"
  ON forms FOR DELETE
  TO authenticated
  USING (account_id IN (SELECT account_id FROM users WHERE id = (SELECT auth.uid())));

-- ============================================================================
-- Optimize AI-related policies
-- ============================================================================

-- Feature Importance Policies
CREATE POLICY "Users can view feature importance for their account"
    ON feature_importance FOR SELECT
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert feature importance for their account"
    ON feature_importance FOR INSERT
    TO authenticated
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

-- Model Performance Policies
CREATE POLICY "Users can view model performance for their account"
    ON model_performance FOR SELECT
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert model performance for their account"
    ON model_performance FOR INSERT
    TO authenticated
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update model performance for their account"
    ON model_performance FOR UPDATE
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

-- Prediction History Policies
CREATE POLICY "Users can view prediction history for their account"
    ON prediction_history FOR SELECT
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert prediction history for their account"
    ON prediction_history FOR INSERT
    TO authenticated
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update prediction history for their account"
    ON prediction_history FOR UPDATE
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

-- Training Jobs Policies
CREATE POLICY "Users can view training jobs for their account"
    ON training_jobs FOR SELECT
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert training jobs for their account"
    ON training_jobs FOR INSERT
    TO authenticated
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update training jobs for their account"
    ON training_jobs FOR UPDATE
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

-- Model Readiness Policies
CREATE POLICY "Users can view model readiness for their account"
    ON model_readiness FOR SELECT
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert model readiness for their account"
    ON model_readiness FOR INSERT
    TO authenticated
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update model readiness for their account"
    ON model_readiness FOR UPDATE
    TO authenticated
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = (SELECT auth.uid())
        )
    );

-- ============================================================================
-- Add indexes on account_id columns for better RLS performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
CREATE INDEX IF NOT EXISTS idx_companies_account_id ON companies(account_id);
CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id);
CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_account_id ON pipelines(account_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
CREATE INDEX IF NOT EXISTS idx_forms_account_id ON forms(account_id);
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);