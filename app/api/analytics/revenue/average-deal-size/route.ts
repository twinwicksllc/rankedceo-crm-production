import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAverageDealSize } from '@/lib/analytics/revenue';

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

    // Get query parameters for date filtering
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const averageDealSize = await getAverageDealSize(accountId, startDate, endDate);

    return NextResponse.json({ averageDealSize });
  } catch (error) {
    console.error('[Average Deal Size API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch average deal size' },
      { status: 500 }
    );
  }
}