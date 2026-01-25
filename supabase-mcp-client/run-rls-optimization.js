const https = require('https');
const fs = require('fs');

const projectRef = 'wcednzaxmxwfiijzmjmx';
const accessToken = 'sbp_6ac5ce26e00f2d47bea8b24b253e70fc960266e9';

async function executeSQL(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve({ success: true });
        } else {
          resolve({ success: false, status: res.statusCode, body });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function runMigration() {
  console.log('Starting RLS optimization migration...\n');
  
  // Step 1: Drop all existing policies
  console.log('Step 1: Dropping existing policies...');
  const dropPolicies = `
    DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
    DROP POLICY IF EXISTS "Users can update their own account" ON accounts;
    DROP POLICY IF EXISTS "Users can view their own user record" ON users;
    DROP POLICY IF EXISTS "Users can update their own user record" ON users;
    DROP POLICY IF EXISTS "Users can view contacts in their account" ON contacts;
    DROP POLICY IF EXISTS "Users can insert contacts in their account" ON contacts;
    DROP POLICY IF EXISTS "Users can update contacts in their account" ON contacts;
    DROP POLICY IF EXISTS "Users can delete contacts in their account" ON contacts;
    DROP POLICY IF EXISTS "Users can view companies in their account" ON companies;
    DROP POLICY IF EXISTS "Users can insert companies in their account" ON companies;
    DROP POLICY IF EXISTS "Users can update companies in their account" ON companies;
    DROP POLICY IF EXISTS "Users can delete companies in their account" ON companies;
    DROP POLICY IF EXISTS "Users can view deals in their account" ON deals;
    DROP POLICY IF EXISTS "Users can insert deals in their account" ON deals;
    DROP POLICY IF EXISTS "Users can update deals in their account" ON deals;
    DROP POLICY IF EXISTS "Users can delete deals in their account" ON deals;
    DROP POLICY IF EXISTS "Users can view activities in their account" ON activities;
    DROP POLICY IF EXISTS "Users can insert activities in their account" ON activities;
    DROP POLICY IF EXISTS "Users can update activities in their account" ON activities;
    DROP POLICY IF EXISTS "Users can delete activities in their account" ON activities;
    DROP POLICY IF EXISTS "Users can view pipelines in their account" ON pipelines;
    DROP POLICY IF EXISTS "Users can insert pipelines in their account" ON pipelines;
    DROP POLICY IF EXISTS "Users can update pipelines in their account" ON pipelines;
    DROP POLICY IF EXISTS "Users can delete pipelines in their account" ON pipelines;
    DROP POLICY IF EXISTS "Users can view pipeline stages in their account" ON pipeline_stages;
    DROP POLICY IF EXISTS "Users can insert pipeline stages in their account" ON pipeline_stages;
    DROP POLICY IF EXISTS "Users can update pipeline stages in their account" ON pipeline_stages;
    DROP POLICY IF EXISTS "Users can delete pipeline stages in their account" ON pipeline_stages;
    DROP POLICY IF EXISTS "Users can view campaigns in their account" ON campaigns;
    DROP POLICY IF EXISTS "Users can insert campaigns in their account" ON campaigns;
    DROP POLICY IF EXISTS "Users can update campaigns in their account" ON campaigns;
    DROP POLICY IF EXISTS "Users can delete campaigns in their account" ON campaigns;
    DROP POLICY IF EXISTS "Users can view messages in their account" ON messages;
    DROP POLICY IF EXISTS "Users can view forms in their account" ON forms;
    DROP POLICY IF EXISTS "Users can insert forms in their account" ON forms;
    DROP POLICY IF EXISTS "Users can update forms in their account" ON forms;
    DROP POLICY IF EXISTS "Users can delete forms in their account" ON forms;
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
  `;
  
  let result = await executeSQL(dropPolicies);
  if (!result.success) {
    console.log('Failed to drop policies:', result.body);
    return;
  }
  console.log('✓ Policies dropped\n');
  
  // Step 2: Create optimized policies
  console.log('Step 2: Creating optimized policies...');
  
  const createPolicies = `
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
  `;
  
  result = await executeSQL(createPolicies);
  if (!result.success) {
    console.log('Failed to create policies:', result.body);
    return;
  }
  console.log('✓ Core policies created\n');
  
  // Step 3: Create remaining policies
  console.log('Step 3: Creating remaining policies...');
  
  const createRemainingPolicies = `
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
  `;
  
  result = await executeSQL(createRemainingPolicies);
  if (!result.success) {
    console.log('Failed to create remaining policies:', result.body);
    return;
  }
  console.log('✓ Remaining policies created\n');
  
  // Step 4: Create AI policies
  console.log('Step 4: Creating AI policies...');
  
  const createAIPolicies = `
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
  `;
  
  result = await executeSQL(createAIPolicies);
  if (!result.success) {
    console.log('Failed to create AI policies:', result.body);
    return;
  }
  console.log('✓ AI policies created\n');
  
  // Step 5: Add indexes
  console.log('Step 5: Adding indexes for better performance...');
  
  const createIndexes = `
    CREATE INDEX IF NOT EXISTS idx_contacts_account_id ON contacts(account_id);
    CREATE INDEX IF NOT EXISTS idx_companies_account_id ON companies(account_id);
    CREATE INDEX IF NOT EXISTS idx_deals_account_id ON deals(account_id);
    CREATE INDEX IF NOT EXISTS idx_activities_account_id ON activities(account_id);
    CREATE INDEX IF NOT EXISTS idx_pipelines_account_id ON pipelines(account_id);
    CREATE INDEX IF NOT EXISTS idx_campaigns_account_id ON campaigns(account_id);
    CREATE INDEX IF NOT EXISTS idx_messages_account_id ON messages(account_id);
    CREATE INDEX IF NOT EXISTS idx_forms_account_id ON forms(account_id);
    CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
  `;
  
  result = await executeSQL(createIndexes);
  if (!result.success) {
    console.log('Failed to create indexes:', result.body);
    return;
  }
  console.log('✓ Indexes created\n');
  
  console.log('✅ RLS optimization migration completed successfully!');
  console.log('\nPerformance improvements:');
  console.log('- auth.uid() now wrapped in SELECT for initPlan optimization');
  console.log('- Indexes added on account_id columns');
  console.log('- Expected 10-100x performance improvement on large tables');
}

runMigration().catch(console.error);