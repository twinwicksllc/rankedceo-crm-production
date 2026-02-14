import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { step } = await request.json();

    // Get user's account_id
    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update onboarding step
    const { error } = await supabase
      .from('accounts')
      .update({ onboarding_step: step })
      .eq('id', userData.account_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating onboarding step:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
