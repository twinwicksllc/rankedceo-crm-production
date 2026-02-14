import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const companyInfo = await request.json();

    // Get user's account_id
    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update company info and move to next step
    const { error } = await supabase
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
      .eq('id', userData.account_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating company info:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
