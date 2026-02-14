import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[Company Info] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const companyInfo = await request.json();
    console.log('[Company Info] Updating for user:', user.email);

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (userError || !userData || !userData.account_id) {
      console.error('[Company Info] User lookup failed:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Company Info] Found account_id:', userData.account_id);
    console.log('[Company Info] Company data:', companyInfo);

    // Use SECURITY DEFINER function to bypass RLS
    const { error } = await supabase.rpc('update_company_info', {
      p_account_id: userData.account_id,
      p_name: companyInfo.name || '',
      p_company_size: companyInfo.company_size || null,
      p_industry: companyInfo.industry || null,
      p_website: companyInfo.website || null,
      p_phone: companyInfo.phone || null,
      p_address: companyInfo.address || null,
    });

    if (error) {
      console.error('[Company Info] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Company Info] Successfully updated account');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Company Info] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
