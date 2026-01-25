-- Migration: AI Predictive Lead Conversion System
-- Description: Add tables and fields for AI-powered lead scoring and conversion prediction

-- ============================================================================
-- 1. Add AI fields to contacts table
-- ============================================================================

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_conversion_score INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_conversion_probability DECIMAL(5,4);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_confidence_score DECIMAL(5,4);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_lead_segment VARCHAR(20); -- 'hot', 'warm', 'cold'
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_contributing_factors JSONB DEFAULT '[]';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_recommended_actions JSONB DEFAULT '[]';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_score_updated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ai_model_version VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_contacts_ai_score ON contacts(ai_conversion_score);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_segment ON contacts(ai_lead_segment);
CREATE INDEX IF NOT EXISTS idx_contacts_ai_updated ON contacts(ai_score_updated_at);

-- ============================================================================
-- 2. Feature importance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS feature_importance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    feature_name VARCHAR(100) NOT NULL,
    importance_score DECIMAL(5,4) NOT NULL,
    feature_type VARCHAR(50), -- 'demographic', 'engagement', 'interaction', 'temporal', 'deal'
    feature_category VARCHAR(50), -- 'industry', 'company_size', 'email_open_rate', etc.
    model_version VARCHAR(50) NOT NULL,
    sample_size INTEGER, -- number of samples used to calculate importance
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_feature_importance_account FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_feature_importance_account ON feature_importance(account_id);
CREATE INDEX IF NOT EXISTS idx_feature_importance_version ON feature_importance(model_version);
CREATE INDEX IF NOT EXISTS idx_feature_importance_type ON feature_importance(feature_type);

-- ============================================================================
-- 3. Model performance tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL, -- 'rule_based', 'gemini_ai', 'logistic_regression', 'gradient_boosting'
    metric_name VARCHAR(50) NOT NULL, -- 'accuracy', 'precision', 'recall', 'f1', 'auc_roc'
    metric_value DECIMAL(5,4) NOT NULL,
    training_samples INTEGER,
    validation_samples INTEGER,
    test_samples INTEGER,
    training_duration_seconds INTEGER,
    training_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    
    CONSTRAINT fk_model_performance_account FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_model_performance_account ON model_performance(account_id);
CREATE INDEX IF NOT EXISTS idx_model_performance_version ON model_performance(model_version);
CREATE INDEX IF NOT EXISTS idx_model_performance_active ON model_performance(is_active);
CREATE INDEX IF NOT EXISTS idx_model_performance_date ON model_performance(training_date);

-- ============================================================================
-- 4. Prediction history for audit and accuracy tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    predicted_probability DECIMAL(5,4) NOT NULL,
    confidence_score DECIMAL(5,4),
    lead_segment VARCHAR(20),
    contributing_factors JSONB,
    recommended_actions JSONB,
    actual_outcome VARCHAR(20), -- 'converted', 'not_converted', 'pending'
    outcome_date TIMESTAMP WITH TIME ZONE,
    prediction_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_prediction_history_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    CONSTRAINT fk_prediction_history_contact FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE INDEX IF NOT EXISTS idx_prediction_history_account ON prediction_history(account_id);
CREATE INDEX IF NOT EXISTS idx_prediction_history_contact ON prediction_history(contact_id);
CREATE INDEX IF NOT EXISTS idx_prediction_history_date ON prediction_history(prediction_date);
CREATE INDEX IF NOT EXISTS idx_prediction_history_outcome ON prediction_history(actual_outcome);

-- ============================================================================
-- 5. Model training jobs
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'completed', 'failed'
    trigger_type VARCHAR(50), -- 'manual', 'scheduled', 'performance_drop', 'data_threshold'
    training_samples INTEGER,
    validation_samples INTEGER,
    test_samples INTEGER,
    performance_metrics JSONB,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_training_jobs_account FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_account ON training_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);
CREATE INDEX IF NOT EXISTS idx_training_jobs_created ON training_jobs(created_at);

-- ============================================================================
-- 6. Model readiness tracking (NEW - for data requirements)
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_readiness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    model_type VARCHAR(50) NOT NULL, -- 'rule_based', 'gemini_ai', 'logistic_regression', 'gradient_boosting'
    is_ready BOOLEAN DEFAULT false,
    readiness_score DECIMAL(5,4), -- 0.0 to 1.0
    required_won_deals INTEGER DEFAULT 50,
    required_lost_deals INTEGER DEFAULT 50,
    current_won_deals INTEGER DEFAULT 0,
    current_lost_deals INTEGER DEFAULT 0,
    required_contacts INTEGER DEFAULT 100,
    current_contacts INTEGER DEFAULT 0,
    required_activities INTEGER DEFAULT 200,
    current_activities INTEGER DEFAULT 0,
    min_data_quality_score DECIMAL(5,4) DEFAULT 0.7,
    current_data_quality_score DECIMAL(5,4),
    readiness_message TEXT,
    last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT fk_model_readiness_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    UNIQUE(account_id, model_type)
);

CREATE INDEX IF NOT EXISTS idx_model_readiness_account ON model_readiness(account_id);
CREATE INDEX IF NOT EXISTS idx_model_readiness_ready ON model_readiness(is_ready);

-- ============================================================================
-- 7. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE feature_importance ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_readiness ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. RLS Policies
-- ============================================================================

-- Feature Importance Policies
CREATE POLICY "Users can view feature importance for their account"
    ON feature_importance FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert feature importance for their account"
    ON feature_importance FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Model Performance Policies
CREATE POLICY "Users can view model performance for their account"
    ON model_performance FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert model performance for their account"
    ON model_performance FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update model performance for their account"
    ON model_performance FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Prediction History Policies
CREATE POLICY "Users can view prediction history for their account"
    ON prediction_history FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert prediction history for their account"
    ON prediction_history FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update prediction history for their account"
    ON prediction_history FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Training Jobs Policies
CREATE POLICY "Users can view training jobs for their account"
    ON training_jobs FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert training jobs for their account"
    ON training_jobs FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update training jobs for their account"
    ON training_jobs FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Model Readiness Policies
CREATE POLICY "Users can view model readiness for their account"
    ON model_readiness FOR SELECT
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert model readiness for their account"
    ON model_readiness FOR INSERT
    WITH CHECK (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update model readiness for their account"
    ON model_readiness FOR UPDATE
    USING (
        account_id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Note: Model readiness will be initialized via application code when accounts are created