import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('[Preferences] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const preferences = await request.json();
    console.log('[Preferences] Updating for user:', user.email);

    // Get user's account_id
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (userError || !userData || !userData.account_id) {
      console.error('[Preferences] User lookup failed:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    console.log('[Preferences] Found account_id:', userData.account_id);

    // Update preferences in account settings
    const { data: updateData, error } = await supabase
      .from('accounts')
      .update({
        timezone: preferences.timezone,
        settings: {
          currency: preferences.currency,
          date_format: preferences.date_format,
        },
      })
      .eq('id', userData.account_id)
      .select();

    if (error) {
      console.error('[Preferences] Update error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!updateData || updateData.length === 0) {
      console.error('[Preferences] No rows updated');
      return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 });
    }

    console.log('[Preferences] Successfully updated');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Preferences] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
