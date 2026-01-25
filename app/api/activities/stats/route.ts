import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Get user and account_id
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users')
      .select('account_id')
      .eq('id', user.id)
      .single();

    if (!userData?.account_id) {
      return NextResponse.json({ error: 'No account found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('activities')
      .select('type, status')
      .eq('account_id', userData.account_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats = {
      total: data?.length || 0,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      pending: 0,
      completed: 0,
    };

    data?.forEach(activity => {
      if (!stats.byType[activity.type]) {
        stats.byType[activity.type] = 0;
      }
      stats.byType[activity.type]++;

      if (!stats.byStatus[activity.status]) {
        stats.byStatus[activity.status] = 0;
      }
      stats.byStatus[activity.status]++;

      if (activity.status === 'pending') {
        stats.pending++;
      }
      if (activity.status === 'completed') {
        stats.completed++;
      }
    });

    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}