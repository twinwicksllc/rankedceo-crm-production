import { notFound, redirect } from 'next/navigation';
import { activityService } from '@/lib/services/activity-service';
import ActivityForm from '@/components/forms/activity-form';

export const dynamic = 'force-dynamic';

export default async function EditActivityPage({
  params,
}: {
  params: { id: string };
}) {
  const activity = await activityService.getActivityById(params.id);

  if (!activity) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Edit Activity</h1>
        <p className="text-gray-600 mt-1">
          Update activity details
        </p>
      </div>

      <ActivityForm
        initialData={{
          type: activity.type,
          title: activity.title,
          description: activity.description || undefined,
          contact_id: activity.contact_id || undefined,
          company_id: activity.company_id || undefined,
          deal_id: activity.deal_id || undefined,
          status: activity.status,
          due_date: activity.due_date || undefined,
          duration_minutes: activity.duration_minutes || undefined,
          location: activity.location || undefined,
          attendees: activity.attendees || undefined,
        }}
        onSuccess={() => redirect(`/activities/${params.id}`)}
      />
    </div>
  );
}