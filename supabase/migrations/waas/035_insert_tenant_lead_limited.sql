-- 035_insert_tenant_lead_limited.sql
-- Project: rankedceo-waas (klgvdvryewykzlumbkei). Apply by hand, AFTER 033 and 034
-- have finished. Idempotent: safe to run twice.
--
-- Why: the per-hour rate limit for the tenant-site lead form was a read followed
-- by a separate insert. Parallel requests could all read a count below the limit
-- and then all insert, so the limit could be bypassed. This function counts and
-- inserts in one transaction, under a lock that is taken per tenant, so
-- concurrent submissions for one tenant are serialised.
--
-- Only the service role may call it. The server action (lib/waas/actions/
-- tenant-lead.ts) is the one caller. Anon and authenticated get no access.

CREATE OR REPLACE FUNCTION public.insert_tenant_lead_limited(
  p_tenant_id    uuid,
  p_row          jsonb,
  p_window_start timestamptz,
  p_per_ip       int,
  p_per_email    int,
  p_ip_hash      text,
  p_email        text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ip     int := 0;
  v_email  int := 0;
  v_tenant int := 0;
  v_id     uuid;
BEGIN
  -- One lock per tenant: the counts and the insert below are a single step for
  -- that tenant. Released automatically at the end of the transaction.
  PERFORM pg_advisory_xact_lock(hashtextextended('tenant-lead:' || p_tenant_id::text, 0));

  SELECT count(*) INTO v_tenant
    FROM public.leads
   WHERE tenant_id = p_tenant_id
     AND source = 'tenant_site'
     AND created_at >= p_window_start;

  IF p_ip_hash IS NOT NULL THEN
    SELECT count(*) INTO v_ip
      FROM public.leads
     WHERE tenant_id = p_tenant_id
       AND source = 'tenant_site'
       AND ip_hash = p_ip_hash
       AND created_at >= p_window_start;
  END IF;

  SELECT count(*) INTO v_email
    FROM public.leads
   WHERE tenant_id = p_tenant_id
     AND source = 'tenant_site'
     AND email = p_email
     AND created_at >= p_window_start;

  IF v_ip >= p_per_ip OR v_email >= p_per_email THEN
    RETURN jsonb_build_object('status', 'rate_limited');
  END IF;

  INSERT INTO public.leads (
    tenant_id, source, status, name, email, phone, message,
    service_requested, page_url, ip_hash
  )
  VALUES (
    p_tenant_id,
    'tenant_site',
    'new',
    p_row->>'name',
    p_row->>'email',
    p_row->>'phone',
    p_row->>'message',
    p_row->>'service_requested',
    p_row->>'page_url',
    p_ip_hash
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('status', 'ok', 'id', v_id, 'tenant_count', v_tenant);
END;
$$;

REVOKE ALL ON FUNCTION public.insert_tenant_lead_limited(uuid, jsonb, timestamptz, int, int, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.insert_tenant_lead_limited(uuid, jsonb, timestamptz, int, int, text, text)
  TO service_role;
