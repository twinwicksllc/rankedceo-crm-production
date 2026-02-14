import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[Complete Onboarding] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[Complete Onboarding] Completing for user:', user.email);

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (userError || !userData || !userData.account_id) {
      console.error('[Complete Onboarding] User lookup failed:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Complete Onboarding] Found account_id:', userData.account_id);

    // Use the SECURITY DEFINER function to bypass RLS
    const { error } = await supabase.rpc('complete_onboarding', {
      p_account_id: userData.account_id
    });

    if (error) {
      console.error('[Complete Onboarding] Error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Complete Onboarding] Successfully completed');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Complete Onboarding] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
