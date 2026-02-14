-- Function to update company info during onboarding
CREATE OR REPLACE FUNCTION update_company_info(
    p_account_id UUID,
    p_name VARCHAR,
    p_company_size VARCHAR,
    p_industry VARCHAR,
    p_website VARCHAR,
    p_phone VARCHAR,
    p_address TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET name = p_name,
        company_size = p_company_size,
        industry = p_industry,
        website = p_website,
        phone = p_phone,
        address = p_address,
        onboarding_step = 2
    WHERE id = p_account_id;
END;
$$;

-- Function to update preferences during onboarding
CREATE OR REPLACE FUNCTION update_preferences(
    p_account_id UUID,
    p_timezone VARCHAR,
    p_settings JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE accounts
    SET timezone = p_timezone,
        settings = p_settings
    WHERE id = p_account_id;
END;
$$;

COMMENT ON FUNCTION update_company_info IS 'Updates company information during onboarding, bypassing RLS';
COMMENT ON FUNCTION update_preferences IS 'Updates user preferences during onboarding, bypassing RLS';
