import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('activities')
      .select('type, status');

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