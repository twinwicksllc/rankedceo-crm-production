import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[Onboarding Step] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { step } = await request.json();
    console.log('[Onboarding Step] Updating to step:', step, 'for user:', user.email);

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (userError) {
      console.error('[Onboarding Step] Error fetching user:', userError);
      return NextResponse.json({ error: 'User lookup failed: ' + userError.message }, { status: 500 });
    }

    if (!userData || !userData.account_id) {
      console.error('[Onboarding Step] User not found or no account_id:', userData);
      return NextResponse.json({ error: 'User not found or missing account_id' }, { status: 404 });
    }

    console.log('[Onboarding Step] Found account_id:', userData.account_id);

    // Use the SECURITY DEFINER function to bypass RLS
    const { data: result, error } = await supabase.rpc('update_onboarding_step', {
      p_account_id: userData.account_id,
      p_step: step
    });

    if (error) {
      console.error('[Onboarding Step] Error updating step:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Verify the update worked by fetching the current step
    const { data: verifyData, error: verifyError } = await supabase
      .from('accounts')
      .select('onboarding_step')
      .eq('id', userData.account_id)
      .single();

    if (verifyError) {
      console.error('[Onboarding Step] Error verifying update:', verifyError);
    } else {
      console.log('[Onboarding Step] Verified step is now:', verifyData?.onboarding_step);
    }

    return NextResponse.json({ 
      success: true, 
      step: verifyData?.onboarding_step || step,
      account_id: userData.account_id 
    });
  } catch (error) {
    console.error('[Onboarding Step] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
