-- ============================================================
-- Seed Calendly Connection for dvldawg44@hotmail.com
-- Links the CRM user to their Calendly account so that
-- webhook events automatically save to the appointments table
-- ============================================================

DO $$
DECLARE
  v_user_id       UUID;
  v_account_id    UUID;
  v_connection_id UUID;
  v_auth_user_id  UUID;
  v_primary_email TEXT := 'dvldawg44@hotmail.com';
  v_fallback_email TEXT := 'twinwicksllc@gmail.com';
BEGIN

  -- -- 1. Find user by primary email --------------------------
  SELECT id, account_id INTO v_user_id, v_account_id
  FROM public.users
  WHERE email = v_primary_email
  LIMIT 1;

  -- -- 2. Fallback: try the Calendly/auth email -----------------
  IF v_user_id IS NULL THEN
    SELECT id, account_id INTO v_user_id, v_account_id
    FROM public.users
    WHERE email = v_fallback_email
    LIMIT 1;
    IF v_user_id IS NOT NULL THEN
      RAISE NOTICE 'Found user via fallback email: % (id: %)', v_fallback_email, v_user_id;
    END IF;
  ELSE
    RAISE NOTICE 'Found user: % (id: %)', v_primary_email, v_user_id;
  END IF;

  -- -- 3. If still not found, create user + account ------------
  -- NOTE: public.users.id is a PRIMARY KEY that REFERENCES auth.users(id)
  -- with no default value, so a new users row can only be created for an
  -- auth.users row that already exists. On a fresh/preview database there
  -- is no auth user for this specific production account, so this seed
  -- (which is account-specific data for one real customer, not schema)
  -- must safely no-op instead of trying to fabricate a disconnected user.
  IF v_user_id IS NULL THEN
    SELECT id INTO v_auth_user_id
    FROM auth.users
    WHERE email IN (v_primary_email, v_fallback_email)
    LIMIT 1;

    IF v_auth_user_id IS NULL THEN
      RAISE NOTICE 'Skipping Calendly connection seed: no auth.users row found for % or % (expected on fresh/preview databases).', v_primary_email, v_fallback_email;
      RETURN;
    END IF;

    RAISE NOTICE 'No public.users row found. Creating account and user for: %', v_primary_email;

    -- Get or create account
    SELECT id INTO v_account_id
    FROM public.accounts
    WHERE slug = 'my-account'
    LIMIT 1;

    IF v_account_id IS NULL THEN
      INSERT INTO public.accounts (
        name, slug, status, plan, test_mode,
        settings, onboarding_completed, timezone
      ) VALUES (
        'My Account', 'my-account', 'active', 'starter', false,
        '{}'::jsonb, false, 'America/Chicago'
      ) RETURNING id INTO v_account_id;
      RAISE NOTICE 'Created account: %', v_account_id;
    END IF;

    -- Create user (id must match the existing auth.users row)
    INSERT INTO public.users (
      id, account_id, email, name, role, status, last_login_at
    ) VALUES (
      v_auth_user_id,
      v_account_id,
      v_primary_email,
      'Twin Wicks Digital Solutions',
      'admin',
      'active',
      NOW()
    ) RETURNING id INTO v_user_id;

    RAISE NOTICE 'Created user: % (id: %)', v_primary_email, v_user_id;
  END IF;

  -- -- 4. Remove any existing Calendly connections for this user --
  DELETE FROM public.calendly_connections
  WHERE user_id = v_user_id;

  -- Also remove any stale connections with the same Calendly URI
  DELETE FROM public.calendly_connections
  WHERE calendly_user_uri = 'https://api.calendly.com/users/76680c9a-afef-48bd-ada4-a335c853ae32';

  -- -- 5. Insert the Calendly connection -------------------------
  INSERT INTO public.calendly_connections (
    account_id,
    user_id,
    access_token,
    calendly_user_uri,
    calendly_user_name,
    calendly_user_email,
    calendly_organization_uri,
    is_active
  ) VALUES (
    v_account_id,
    v_user_id,
    -- Personal Access Token (used as access token for API calls)
    'eyJraWQiOiIxY2UxZTEzNjE3ZGNmNzY2YjNjZWJjY2Y4ZGM1YmFmYThhNjVlNjg0MDIzZjdjMzJiZTgzNDliMjM4MDEzNWI0IiwidHlwIjoiUEFUIiwiYWxnIjoiRVMyNTYifQ.eyJpc3MiOiJodHRwczovL2F1dGguY2FsZW5kbHkuY29tIiwiaWF0IjoxNzcyMzMxMDQ3LCJqdGkiOiI2MjJlZTQxZC01YzJmLTQxMTktYjc1OC1iMmFiNmFjNjE2ZjAiLCJ1c2VyX3V1aWQiOiI3NjY4MGM5YS1hZmVmLTQ4YmQtYWRhNC1hMzM1Yzg1M2FlMzIifQ.2zlt5MEER1B8zg7TxUAug203DlrrJhZrpUoKC8oOZKuypKjE1P9sJ0JGJ05iQomG_TWCAt6lu2z2hlZY1R8ffQ',
    'https://api.calendly.com/users/76680c9a-afef-48bd-ada4-a335c853ae32',
    'Twin Wicks Digital Solutions',
    'twinwicksllc@gmail.com',
    'https://api.calendly.com/organizations/e1366502-e34a-4c7b-a80b-1bfcb83a1041',
    true
  ) RETURNING id INTO v_connection_id;

  RAISE NOTICE 'Calendly connection created (id: %)', v_connection_id;
  RAISE NOTICE '   User ID    : %', v_user_id;
  RAISE NOTICE '   Account ID : %', v_account_id;
  RAISE NOTICE '   Calendly   : https://api.calendly.com/users/76680c9a-afef-48bd-ada4-a335c853ae32';
  RAISE NOTICE '   Status     : active';
  RAISE NOTICE '';
  RAISE NOTICE 'New Calendly bookings will now automatically save to the appointments table.';

END $$;
