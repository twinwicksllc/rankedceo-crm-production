import { notFound } from 'next/navigation';
import { activityService } from '@/lib/services/activity-service';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ActivityDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const activity = await activityService.getActivityById(params.id);

  if (!activity) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/activities" className="text-blue-600 hover:underline text-sm">
            ← Back to Activities
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {activity.title}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={getStatusColor(activity.status)}>
              {activity.status}
            </Badge>
            <span className="text-gray-600">
              {formatDate(activity.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/activities/${activity.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Button variant="destructive">Delete</Button>
        </div>
      </div>

      {/* Activity Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          {activity.description && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-3">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {activity.description}
              </p>
            </div>
          )}

          {/* Related Activity Timeline */}
          {activity.contact_id || activity.company_id || activity.deal_id ? (
            <ActivityTimeline
              title="Related Activities"
              activities={[]} // Would fetch related activities here
            />
          ) : null}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity Type */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-3">Activity Details</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Type</div>
                <div className="font-medium capitalize">{activity.type}</div>
              </div>
              {activity.due_date && (
                <div>
                  <div className="text-sm text-gray-600">Due Date</div>
                  <div className="font-medium">{formatDate(activity.due_date)}</div>
                </div>
              )}
              {activity.duration_minutes && (
                <div>
                  <div className="text-sm text-gray-600">Duration</div>
                  <div className="font-medium">{activity.duration_minutes} minutes</div>
                </div>
              )}
              {activity.location && (
                <div>
                  <div className="text-sm text-gray-600">Location</div>
                  <div className="font-medium">{activity.location}</div>
                </div>
              )}
            </div>
          </div>

          {/* Related Entities */}
          {(activity.contact || activity.company || activity.deal) && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-3">Related To</h3>
              <div className="space-y-3">
                {activity.contact && (
                  <Link href={`/contacts/${activity.contact.id}`}>
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        👤
                      </div>
                      <div>
                        <div className="font-medium">
                          {activity.contact.first_name} {activity.contact.last_name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {activity.contact.email}
                        </div>
                      </div>
                    </div>
                  </Link>
                )}
                {activity.company && (
                  <Link href={`/companies/${activity.company.id}`}>
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                        🏢
                      </div>
                      <div className="font-medium">{activity.company.name}</div>
                    </div>
                  </Link>
                )}
                {activity.deal && (
                  <Link href={`/deals/${activity.deal.id}`}>
                    <div className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                        💰
                      </div>
                      <div className="font-medium">{activity.deal.title}</div>
                    </div>
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Attendees */}
          {activity.attendees && activity.attendees.length > 0 && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-3">Attendees</h3>
              <div className="space-y-2">
                {activity.attendees.map((attendee, index) => (
                  <div key={index} className="text-sm">
                    👥 {attendee}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          {activity.completed_at && (
            <div className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold mb-3">Completion</h3>
              <div className="text-sm text-gray-600">
                Completed on {formatDate(activity.completed_at)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}