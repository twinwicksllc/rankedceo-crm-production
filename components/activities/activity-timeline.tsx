import { ActivityWithRelations } from '@/lib/types/activity';
import { Card } from '@/components/ui/card';
import { ActivityCard } from './activity-card';

interface ActivityTimelineProps {
  activities: ActivityWithRelations[];
  title?: string;
}

export function ActivityTimeline({ activities, title = 'Activity Timeline' }: ActivityTimelineProps) {
  if (activities.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">No activities yet</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-6">{title}</h3>
      <div className="space-y-6">
        {activities.map((activity) => (
          <div key={activity.id} className="relative">
            <div className="absolute left-3 top-8 bottom-0 w-0.5 bg-gray-200" />
            <div className="relative pl-8">
              <ActivityCard activity={activity} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}