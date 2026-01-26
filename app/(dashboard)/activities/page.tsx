import { Suspense } from 'react';
import Link from 'next/link';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

async function getActivities(filters: any, accountId: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('activities')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (filters.type) query = query.eq('type', filters.type);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) {
    query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }

  const { data, error } = await query;
  
  if (error) {
    console.error('Error fetching activities:', error);
    return [];
  }
  
  return data || [];
}

async function getActivityStats(accountId: string) {
  const supabase = await createClient();
  
  const { data: activities, error } = await supabase
    .from('activities')
    .select('type, status')
    .eq('account_id', accountId);
  
  if (error || !activities) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      byType: {},
    };
  }
  
  const stats = {
    total: activities.length,
    completed: activities.filter(a => a.status === 'completed').length,
    pending: activities.filter(a => a.status === 'pending').length,
    byType: activities.reduce((acc: any, activity) => {
      acc[activity.type] = (acc[activity.type] || 0) + 1;
      return acc;
    }, {}),
  };
  
  return stats;
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; search?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  // Get user's account_id by email
  const { data: userData } = await supabase
    .from('users')
    .select('account_id')
    .eq('email', user.email)
    .single();

  if (!userData?.account_id) return null;

  const filters = {
    type: searchParams.type,
    status: searchParams.status,
    search: searchParams.search,
  };

  const [activities, stats] = await Promise.all([
    getActivities(filters, userData.account_id),
    getActivityStats(userData.account_id),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activities</h1>
          <p className="text-gray-600 mt-1">
            Track all your interactions and tasks
          </p>
        </div>
        <Link href="/activities/new">
          <Button>+ Add Activity</Button>
        </Link>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Total Activities</div>
          <div className="text-3xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Completed</div>
          <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Pending Tasks</div>
          <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
        </Card>
        <Card className="p-6">
          <div className="text-sm text-gray-600 mb-1">Activity Types</div>
          <div className="text-3xl font-bold">
            {Object.keys(stats.byType).length}
          </div>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Suspense fallback={<div>Loading activities...</div>}>
        <ActivityTimeline activities={activities} />
      </Suspense>
    </div>
  );
}