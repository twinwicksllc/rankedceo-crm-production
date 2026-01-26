-- Migration: Fix Users and Accounts with Correct Schema
-- Description: Handles existing tables with actual schema (includes slug, status, plan, etc.)

-- ============================================================================
-- 1. Create Accounts Table (IF NOT EXISTS) - with correct schema
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'My Account',
    slug VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    plan VARCHAR(50) DEFAULT 'starter',
    is_active BOOLEAN DEFAULT true,
    logo_url TEXT,
    website_url TEXT,
    settings JSONB DEFAULT '{}',
    billing_email VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    is_deleted BOOLEAN DEFAULT false,
    user_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    timezone VARCHAR(100) DEFAULT 'America/New_York',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    
    CONSTRAINT accounts_name_not_empty CHECK (length(trim(name)) > 0),
    CONSTRAINT accounts_slug_not_empty CHECK (length(trim(slug)) > 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at);
CREATE INDEX IF NOT EXISTS idx_accounts_slug ON accounts(slug);
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_plan ON accounts(plan);

-- ============================================================================
-- 2. Create Users Table (IF NOT EXISTS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'member',
    status VARCHAR(50) DEFAULT 'active',
    phone VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT users_account_id_not_null CHECK (account_id IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Drop Existing Policies if They Exist
-- ============================================================================

-- Drop policies on users table
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
DROP POLICY IF EXISTS "Users can insert their own user record" ON users;

-- Drop policies on accounts table
DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;
DROP POLICY IF EXISTS "Users can insert their own account" ON accounts;

-- ============================================================================
-- 5. Create RLS Policies for Users Table
-- ============================================================================

-- Users can view their own user record
CREATE POLICY "Users can view their own user record"
ON users FOR SELECT
USING (auth.uid() = id);

-- Users can update their own user record
CREATE POLICY "Users can update their own user record"
ON users FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own user record (for new signups)
CREATE POLICY "Users can insert their own user record"
ON users FOR INSERT
WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 6. Create RLS Policies for Accounts Table
-- ============================================================================

-- Users can view their own account
CREATE POLICY "Users can view their own account"
ON accounts FOR SELECT
USING (
    id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    )
);

-- Users can update their own account
CREATE POLICY "Users can update their own account"
ON accounts FOR UPDATE
USING (
    id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    )
)
WITH CHECK (
    id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    )
);

-- Users can insert their own account (for new signups)
CREATE POLICY "Users can insert their own account"
ON accounts FOR INSERT
WITH CHECK (
    id IN (
        SELECT account_id FROM users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- 7. Create Function to Handle New User Signups
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_account_id UUID;
    user_email TEXT;
BEGIN
    -- Get user email from auth metadata
    user_email := NEW.email;
    
    -- Check if account already exists for this user
    SELECT account_id INTO user_account_id FROM users WHERE id = NEW.id LIMIT 1;
    
    -- If no account linked, find or create default account
    IF user_account_id IS NULL THEN
        -- Try to find existing default account
        SELECT id INTO user_account_id FROM accounts 
        WHERE name = 'My Account' 
        AND slug = 'my-account'
        LIMIT 1;
        
        -- If no default account exists, create one with all required fields
        IF user_account_id IS NULL THEN
            INSERT INTO accounts (
                name, 
                slug, 
                status, 
                plan, 
                is_active, 
                settings, 
                metadata, 
                is_deleted, 
                user_count,
                timezone
            )
            VALUES (
                'My Account',
                'my-account',
                'active',
                'starter',
                true,
                '{}'::jsonb,
                '{}'::jsonb,
                false,
                1,
                'America/New_York'
            )
            RETURNING id INTO user_account_id;
        END IF;
    END IF;
    
    -- Insert user record with all required fields
    INSERT INTO users (id, account_id, full_name, avatar_url, email, role, status, metadata)
    VALUES (
        NEW.id,
        user_account_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
        user_email,
        'admin',
        'active',
        COALESCE(NEW.raw_user_meta_data, '{}'::jsonb)
    )
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. Create Trigger for New User Signups
-- ============================================================================

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 9. Create Function to Handle User Deletions
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_user_delete()
RETURNS TRIGGER AS $$
DECLARE
    deleted_account_id UUID;
BEGIN
    -- Get the account ID of the deleted user
    SELECT account_id INTO deleted_account_id FROM users WHERE id = OLD.id;
    
    -- Delete user record (will cascade to other records)
    DELETE FROM users WHERE id = OLD.id;
    
    -- If this was the last user in the account, mark account as deleted
    IF NOT EXISTS (SELECT 1 FROM users WHERE account_id = deleted_account_id) THEN
        UPDATE accounts 
        SET is_deleted = true,
            deleted_at = NOW(),
            status = 'deleted',
            user_count = 0
        WHERE id = deleted_account_id;
    ELSE
        -- Update user count
        UPDATE accounts 
        SET user_count = user_count - 1
        WHERE id = deleted_account_id;
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. Create Trigger for User Deletions
-- ============================================================================

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_deleted
AFTER DELETE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_user_delete();

-- ============================================================================
-- 11. Create Function to Update Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 12. Create Timestamp Update Triggers
-- ============================================================================

-- Drop triggers if they exist
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

-- Create triggers
CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 13. Migration for Existing Users (if any exist without user records)
-- ============================================================================

-- This section ensures all auth users have corresponding user records
DO $$
DECLARE
    auth_user_record RECORD;
    default_account_id UUID;
    user_slug TEXT;
BEGIN
    -- Get default account or create one
    SELECT id INTO default_account_id FROM accounts 
    WHERE name = 'My Account' 
    AND slug = 'my-account'
    LIMIT 1;
    
    IF default_account_id IS NULL THEN
        -- Create default account with all required fields
        INSERT INTO accounts (
            name, 
            slug, 
            status, 
            plan, 
            is_active, 
            settings, 
            metadata, 
            is_deleted, 
            user_count,
            timezone
        )
        VALUES (
            'My Account',
            'my-account',
            'active',
            'starter',
            true,
            '{}'::jsonb,
            '{}'::jsonb,
            false,
            0,
            'America/New_York'
        )
        RETURNING id INTO default_account_id;
    END IF;
    
    -- For each auth user without a user record, create one
    FOR auth_user_record IN 
        SELECT id, email, raw_user_meta_data FROM auth.users
        WHERE id NOT IN (SELECT id FROM users)
    LOOP
        -- Create user-friendly slug based on email
        user_slug := lower(regexp_replace(auth_user_record.email, '[^a-zA-Z0-9]', '-', 'g'));
        user_slug := substring(user_slug, 1, 200);
        
        INSERT INTO users (id, account_id, full_name, avatar_url, email, role, status, metadata)
        VALUES (
            auth_user_record.id,
            default_account_id,
            COALESCE(auth_user_record.raw_user_meta_data->>'full_name', ''),
            COALESCE(auth_user_record.raw_user_meta_data->>'avatar_url', ''),
            auth_user_record.email,
            'admin',
            'active',
            COALESCE(auth_user_record.raw_user_meta_data, '{}'::jsonb)
        )
        ON CONFLICT (id) DO NOTHING;
    END LOOP;
    
    -- Update user count
    UPDATE accounts 
    SET user_count = (SELECT COUNT(*) FROM users WHERE account_id = accounts.id)
    WHERE id = default_account_id;
    
    RAISE NOTICE 'Migration completed: All auth users now have user records';
END $$;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Users and Accounts migration completed successfully!';
    RAISE NOTICE 'Tables: accounts, users';
    RAISE NOTICE 'All required columns including slug, status, plan are set';
    RAISE NOTICE 'RLS Policies: Applied';
    RAISE NOTICE 'Triggers: on_auth_user_created, on_auth_user_deleted, update_accounts_updated_at, update_users_updated_at';
END $$;