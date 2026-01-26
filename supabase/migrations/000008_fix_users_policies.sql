-- ============================================================================
-- Fix: Resolve Infinite Recursion in Users Table RLS Policies
-- ============================================================================
-- Problem: The current policies create a circular reference when querying users
-- Solution: Use a simpler approach with direct auth.uid() comparison via email

-- Drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own user record" ON users;
DROP POLICY IF EXISTS "Users can update their own user record" ON users;
DROP POLICY IF EXISTS "Users can insert their own user record" ON users;
DROP POLICY IF EXISTS "Users can delete their own user record" ON users;

-- Create new policies that avoid recursion
-- These policies use a direct comparison with auth.users via email

CREATE POLICY "Users can view their own user record"
    ON users FOR SELECT
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "Users can update their own user record"
    ON users FOR UPDATE
    USING (
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Allow insertion for system operations (like on signup trigger)
CREATE POLICY "Allow system inserts for users"
    ON users FOR INSERT
    WITH CHECK (true);

-- Allow deletion for system operations
CREATE POLICY "Allow system deletes for users"
    ON users FOR DELETE
    USING (true);


-- ============================================================================
-- Also fix the accounts policies to use the same pattern
-- ============================================================================

DROP POLICY IF EXISTS "Users can view their own account" ON accounts;
DROP POLICY IF EXISTS "Users can update their own account" ON accounts;

CREATE POLICY "Users can view their own account"
    ON accounts FOR SELECT
    USING (
        id IN (
            SELECT account_id 
            FROM users 
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update their own account"
    ON accounts FOR UPDATE
    USING (
        id IN (
            SELECT account_id 
            FROM users 
            WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    );