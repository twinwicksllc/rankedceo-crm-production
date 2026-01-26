-- Migration: Safe Creation of Users and Accounts Tables
-- Description: Handles existing tables and policies safely
-- This script will NOT fail if tables or policies already exist

-- ============================================================================
-- 1. Create Accounts Table (safe)
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
-- 2. Create Users Table (safe)
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
-- 4. Drop Existing Policies if They Exist (to avoid conflicts)
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
BEGIN
    -- Check if account already exists
    SELECT id INTO user_account_id FROM accounts WHERE name = 'My Account' AND id = (
        SELECT account_id FROM users WHERE id = NEW.id
    ) LIMIT 1;
    
    -- If no account exists, create one
    IF user_account_id IS NULL THEN
        INSERT INTO accounts (name)
        VALUES ('My Account')
        RETURNING id INTO user_account_id;
    END IF;
    
    -- Insert user record
    INSERT INTO users (id, account_id, full_name, avatar_url)
    VALUES (
        NEW.id,
        user_account_id,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
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
BEGIN
    -- User record will be deleted automatically due to ON DELETE CASCADE
    -- Account deletion logic could be added here if needed
    RETURN NEW;
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
BEGIN
    -- Get default account or create one
    SELECT id INTO default_account_id FROM accounts WHERE name = 'My Account' LIMIT 1;
    
    IF default_account_id IS NULL THEN
        INSERT INTO accounts (name) VALUES ('My Account')
        RETURNING id INTO default_account_id;
    END IF;
    
    -- For each auth user without a user record, create one
    FOR auth_user_record IN 
        SELECT id, raw_user_meta_data FROM auth.users
        WHERE id NOT IN (SELECT id FROM users)
    LOOP
        INSERT INTO users (id, account_id, full_name, avatar_url)
        VALUES (
            auth_user_record.id,
            default_account_id,
            auth_user_record.raw_user_meta_data->>'full_name',
            auth_user_record.raw_user_meta_data->>'avatar_url'
        );
    END LOOP;
    
    RAISE NOTICE 'Migration completed: All auth users now have user records';
END $$;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Users and Accounts migration completed successfully!';
    RAISE NOTICE 'Tables: accounts, users';
    RAISE NOTICE 'RLS Policies: Applied';
    RAISE NOTICE 'Triggers: on_auth_user_created, on_auth_user_deleted, update_accounts_updated_at, update_users_updated_at';
END $$;