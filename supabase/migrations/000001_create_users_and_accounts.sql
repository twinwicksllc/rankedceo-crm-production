-- Migration: Create Users and Accounts tables with RLS
-- Description: Core multi-tenancy structure for RankedCEO CRM

-- ============================================================================
-- 1. Create Accounts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL DEFAULT 'My Account',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT accounts_name_not_empty CHECK (length(trim(name)) > 0)
);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_accounts_created_at ON accounts(created_at);

-- ============================================================================
-- 2. Create Users Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    full_name VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT users_account_id_not_null CHECK (account_id IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_account_id ON users(account_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(id); -- References auth.users.email

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Create Function to Handle New User Signups
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_account_id UUID;
BEGIN
    -- Create a new account for the user
    INSERT INTO accounts (name)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'My Account'))
    RETURNING id INTO new_account_id;
    
    -- Create user record linking to the new account
    INSERT INTO users (id, account_id, full_name, avatar_url)
    VALUES (
        NEW.id,
        new_account_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Create Trigger for New User Signup
-- ============================================================================

-- Drop trigger if exists to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to automatically create account and user record
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 6. RLS Policies for Accounts Table
-- ============================================================================

-- Users can view their own accounts
CREATE POLICY "Users can view their own accounts"
    ON accounts FOR SELECT
    USING (
        id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Users can insert their own accounts
CREATE POLICY "Users can insert their own accounts"
    ON accounts FOR INSERT
    WITH CHECK (
        id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- Users can update their own accounts
CREATE POLICY "Users can update their own accounts"
    ON accounts FOR UPDATE
    USING (
        id IN (
            SELECT account_id FROM users WHERE id = auth.uid()
        )
    );

-- ============================================================================
-- 7. RLS Policies for Users Table
-- ============================================================================

-- Users can view their own user record
CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    USING (id = auth.uid());

-- Users can insert their own user record
CREATE POLICY "Users can insert their own user record"
    ON users FOR INSERT
    WITH CHECK (id = auth.uid());

-- Users can update their own user record
CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    USING (id = auth.uid());

-- ============================================================================
-- 8. Create Function to Update updated_at Timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. Create Triggers for updated_at
-- ============================================================================

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 10. Handle Existing Users (Data Migration)
-- ============================================================================

-- This section creates accounts for users that signed up before this migration
-- It's safe to run multiple times

DO $$
DECLARE
    user_record RECORD;
    new_account_id UUID;
BEGIN
    -- Loop through existing auth.users that don't have a users table record
    FOR user_record IN 
        SELECT au.id, au.email, au.raw_user_meta_data 
        FROM auth.users au
        LEFT JOIN users u ON u.id = au.id
        WHERE u.id IS NULL
    LOOP
        -- Create account for existing user
        INSERT INTO accounts (name)
        VALUES (COALESCE(user_record.raw_user_meta_data->>'full_name', 'My Account'))
        RETURNING id INTO new_account_id;
        
        -- Create user record
        INSERT INTO users (id, account_id, full_name, avatar_url)
        VALUES (
            user_record.id,
            new_account_id,
            COALESCE(user_record.raw_user_meta_data->>'full_name', split_part(user_record.email, '@', 1)),
            user_record.raw_user_meta_data->>'avatar_url'
        );
        
        RAISE NOTICE 'Created account and user record for: %', user_record.email;
    END LOOP;
END $$;