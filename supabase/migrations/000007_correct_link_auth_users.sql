-- Migration: Correctly Link Supabase Auth Users to Existing Users Table
-- Description: Links auth users to users table WITHOUT using metadata column

-- ============================================================================
-- 1. Drop Existing Policies if They Exist
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
DROP POLICY IF EXISTS "Users can insert their own user record" ON users;

DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;
DROP POLICY IF EXISTS "Users can insert their own account" ON accounts;

-- ============================================================================
-- 2. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Create RLS Policies for Users Table
-- ============================================================================

-- Users can view their own user record (by email match with auth)
CREATE POLICY "Users can view their own user record"
ON users FOR SELECT
USING (
    email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
    )
);

-- Users can update their own user record
CREATE POLICY "Users can update their own user record"
ON users FOR UPDATE
USING (
    email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    email = (
        SELECT email FROM auth.users WHERE id = auth.uid()
    )
);

-- ============================================================================
-- 4. Create RLS Policies for Accounts Table
-- ============================================================================

-- Users can view their own account
CREATE POLICY "Users can view their own account"
ON accounts FOR SELECT
USING (
    id IN (
        SELECT account_id FROM users WHERE email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    )
);

-- Users can update their own account
CREATE POLICY "Users can update their own account"
ON accounts FOR UPDATE
USING (
    id IN (
        SELECT account_id FROM users WHERE email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    )
)
WITH CHECK (
    id IN (
        SELECT account_id FROM users WHERE email = (
            SELECT email FROM auth.users WHERE id = auth.uid()
        )
    )
);

-- ============================================================================
-- 5. Create Function to Handle New User Signups
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_account_id UUID;
    existing_user_id UUID;
BEGIN
    -- Check if a user record already exists for this email
    SELECT id, account_id INTO existing_user_id, user_account_id 
    FROM users 
    WHERE email = NEW.email 
    LIMIT 1;
    
    -- If user record exists, just update last_login_at
    IF existing_user_id IS NOT NULL THEN
        UPDATE users 
        SET last_login_at = NOW(),
            updated_at = NOW()
        WHERE id = existing_user_id;
    ELSE
        -- If no user exists, get or create default account
        SELECT id INTO user_account_id FROM accounts 
        WHERE name = 'My Account' 
        AND slug = 'my-account'
        LIMIT 1;
        
        IF user_account_id IS NULL THEN
            -- Create default account with correct schema
            INSERT INTO accounts (
                name, 
                slug, 
                status, 
                plan, 
                test_mode,
                settings, 
                onboarding_completed,
                onboarding_step,
                onboarding_data,
                timezone
            )
            VALUES (
                'My Account',
                'my-account',
                'active',
                'starter',
                false,
                '{}'::jsonb,
                false,
                0,
                '{}'::jsonb,
                'America/New_York'
            )
            RETURNING id INTO user_account_id;
        END IF;
        
        -- Create user record with CORRECT schema (no metadata column)
        INSERT INTO users (
            id,
            account_id,
            email,
            name,
            avatar_url,
            role,
            status,
            last_login_at
        )
        VALUES (
            gen_random_uuid(),
            user_account_id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
            COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
            'admin',
            'active',
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Create Trigger for New User Signups
-- ============================================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 7. Create Function to Update Timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Create Timestamp Update Triggers
-- ============================================================================

DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;

CREATE TRIGGER update_accounts_updated_at
BEFORE UPDATE ON accounts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. Migration for Existing Auth Users
-- ============================================================================

DO $$
DECLARE
    auth_user_record RECORD;
    default_account_id UUID;
    existing_user_id UUID;
BEGIN
    -- Get or create default account
    SELECT id INTO default_account_id FROM accounts 
    WHERE name = 'My Account' 
    AND slug = 'my-account'
    LIMIT 1;
    
    IF default_account_id IS NULL THEN
        INSERT INTO accounts (
            name, 
            slug, 
            status, 
            plan, 
            test_mode,
            settings, 
            onboarding_completed,
            onboarding_step,
            onboarding_data,
            timezone
        )
        VALUES (
            'My Account',
            'my-account',
            'active',
            'starter',
            false,
            '{}'::jsonb,
            false,
            0,
            '{}'::jsonb,
            'America/New_York'
        )
        RETURNING id INTO default_account_id;
    END IF;
    
    -- For each auth user, ensure they have a user record
    FOR auth_user_record IN 
        SELECT id, email, raw_user_meta_data FROM auth.users
    LOOP
        -- Check if user record already exists for this email
        SELECT id INTO existing_user_id FROM users 
        WHERE email = auth_user_record.email 
        LIMIT 1;
        
        IF existing_user_id IS NULL THEN
            -- Create user record with CORRECT schema (no metadata column)
            INSERT INTO users (
                id,
                account_id,
                email,
                name,
                avatar_url,
                role,
                status,
                last_login_at
            )
            VALUES (
                gen_random_uuid(),
                default_account_id,
                auth_user_record.email,
                COALESCE(auth_user_record.raw_user_meta_data->>'full_name', auth_user_record.email),
                COALESCE(auth_user_record.raw_user_meta_data->>'avatar_url', ''),
                'admin',
                'active',
                NOW()
            );
        ELSE
            -- Update existing user record
            UPDATE users 
            SET updated_at = NOW()
            WHERE id = existing_user_id;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Migration completed: All auth users now have user records';
END $$;

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Auth users to users table linking completed successfully!';
    RAISE NOTICE 'RLS Policies: Applied to users and accounts tables';
    RAISE NOTICE 'Triggers: on_auth_user_created, update_accounts_updated_at, update_users_updated_at';
    RAISE NOTICE 'All existing auth users have been linked to user records';
END $$;