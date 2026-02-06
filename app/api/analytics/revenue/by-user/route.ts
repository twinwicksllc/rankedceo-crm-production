import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getRevenueByUser } from '@/lib/analytics/revenue';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get account_id from users table
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_id')
      .eq('email', user.email)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    const accountId = userData.account_id;

    const data = await getRevenueByUser(accountId);

    return NextResponse.json({ data });
  } catch (error) {
    console.error('[Revenue By User API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch revenue by user' },
      { status: 500 }
    );
  }
}