import { Suspense } from 'react';
import Link from 'next/link';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

async function getActivities(filters: any) {
  const searchParams = new URLSearchParams();
  if (filters.type) searchParams.set('type', filters.type);
  if (filters.status) searchParams.set('status', filters.status);
  if (filters.search) searchParams.set('search', filters.search);

  const response = await fetch(`/api/activities?${searchParams.toString()}`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    return [];
  }
  
  return response.json();
}

async function getActivityStats() {
  const response = await fetch('/api/activities/stats', {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      byType: {},
    };
  }
  
  return response.json();
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: { type?: string; status?: string; search?: string };
}) {
  const filters = {
    type: searchParams.type,
    status: searchParams.status,
    search: searchParams.search,
  };

  const [activities, stats] = await Promise.all([
    getActivities(filters),
    getActivityStats(),
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