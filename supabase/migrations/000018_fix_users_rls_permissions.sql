-- ============================================================================
-- Fix: Users & Accounts RLS - Permission Denied Error
-- 
-- Problem: The existing RLS policy queries auth.users inside the policy itself,
-- which causes "permission denied for table users" because the policy evaluation
-- creates a circular dependency or lacks permission to read auth.users.
--
-- Solution: Use a SECURITY DEFINER function to safely look up the user's
-- account_id without triggering RLS recursion or permission errors.
-- ============================================================================

-- ============================================================================
-- 1. Drop ALL existing policies on users and accounts
-- ============================================================================

DO $$ DECLARE
  pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
  FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'accounts' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.accounts', pol.policyname);
  END LOOP;
END $$;

-- ============================================================================
-- 2. Create a SECURITY DEFINER function to get current user's ID from users table
--    This bypasses RLS safely to look up the user record by auth.uid()
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  SET LOCAL row_security = off;
  -- First try matching by auth_user_id if column exists
  BEGIN
    SELECT id INTO v_user_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    v_user_id := NULL;
  END;

  -- Fallback: match by email
  IF v_user_id IS NULL THEN
    SELECT u.id INTO v_user_id
    FROM public.users u
    JOIN auth.users au ON au.email = u.email
    WHERE au.id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_user_id;
END;
$$;

-- ============================================================================
-- 3. Ensure get_current_user_account_id() also works correctly
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_user_account_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SET LOCAL row_security = off;

  -- First try matching by auth_user_id if column exists
  BEGIN
    SELECT account_id INTO v_account_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
  EXCEPTION WHEN undefined_column THEN
    v_account_id := NULL;
  END;

  -- Fallback: match by email
  IF v_account_id IS NULL THEN
    SELECT u.account_id INTO v_account_id
    FROM public.users u
    JOIN auth.users au ON au.email = u.email
    WHERE au.id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN v_account_id;
END;
$$;

-- ============================================================================
-- 4. Apply clean RLS policies to users table
-- ============================================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view themselves and teammates in the same account
CREATE POLICY "users_select_policy"
ON public.users FOR SELECT
TO authenticated
USING (
  account_id = get_current_user_account_id()
);

-- Users can update only their own record
CREATE POLICY "users_update_policy"
ON public.users FOR UPDATE
TO authenticated
USING (
  id = get_current_user_id()
)
WITH CHECK (
  id = get_current_user_id()
);

-- Allow insert for new user creation (via trigger / service role)
CREATE POLICY "users_insert_policy"
ON public.users FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- 5. Apply clean RLS policies to accounts table
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

-- Users can view their own account
CREATE POLICY "accounts_select_policy"
ON public.accounts FOR SELECT
TO authenticated
USING (
  id = get_current_user_account_id()
);

-- Users can update their own account
CREATE POLICY "accounts_update_policy"
ON public.accounts FOR UPDATE
TO authenticated
USING (
  id = get_current_user_account_id()
)
WITH CHECK (
  id = get_current_user_account_id()
);

-- ============================================================================
-- 6. Grant execute permissions on helper functions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_account_id() TO authenticated;

-- ============================================================================
-- 7. Ensure the existing auth user (twinwicksllc@gmail.com) has a user record
--    This handles the case where the user exists in auth but not in users table
-- ============================================================================

DO $$
DECLARE
  v_account_id UUID;
  v_existing_user_id UUID;
  v_auth_email TEXT := 'twinwicksllc@gmail.com';
  v_auth_id UUID;
BEGIN
  -- Get auth user id
  SELECT id INTO v_auth_id FROM auth.users WHERE email = v_auth_email LIMIT 1;

  IF v_auth_id IS NULL THEN
    RAISE NOTICE 'Auth user not found for email: %', v_auth_email;
    RETURN;
  END IF;

  -- Check if user record exists
  SELECT id INTO v_existing_user_id FROM public.users WHERE email = v_auth_email LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    RAISE NOTICE 'User record already exists for: % (id: %)', v_auth_email, v_existing_user_id;
    RETURN;
  END IF;

  -- Get or create account
  SELECT id INTO v_account_id FROM public.accounts
  WHERE slug = 'my-account' LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (
      name, slug, status, plan, test_mode,
      settings, onboarding_completed, timezone
    ) VALUES (
      'My Account', 'my-account', 'active', 'starter', false,
      '{}'::jsonb, false, 'America/New_York'
    ) RETURNING id INTO v_account_id;
    RAISE NOTICE 'Created new account with id: %', v_account_id;
  END IF;

  -- Create user record
  INSERT INTO public.users (
    account_id, email, name, role, status, last_login_at
  ) VALUES (
    v_account_id,
    v_auth_email,
    v_auth_email,
    'admin',
    'active',
    NOW()
  );

  RAISE NOTICE 'Created user record for: %', v_auth_email;
END $$;

-- ============================================================================
-- Success
-- ============================================================================
DO $$ BEGIN
  RAISE NOTICE 'Migration 000018 complete: Users/Accounts RLS fixed with SECURITY DEFINER functions';
END $$;