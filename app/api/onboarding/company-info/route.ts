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

    // Update company info and move to next step
    const { data: updateData, error } = await supabase
      .from('accounts')
      .update({
        name: companyInfo.name,
        company_size: companyInfo.company_size,
        industry: companyInfo.industry,
        website: companyInfo.website,
        phone: companyInfo.phone,
        address: companyInfo.address,
        onboarding_step: 2,
      })
      .eq('id', userData.account_id)
      .select();

    if (error) {
      console.error('[Company Info] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updateData || updateData.length === 0) {
      console.error('[Company Info] No rows updated');
      return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
    }

    console.log('[Company Info] Successfully updated account');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Company Info] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
