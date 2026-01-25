import { ActivityWithRelations, ActivityType } from '@/lib/types/activity';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityIcon } from './activity-icon';
import Link from 'next/link';

interface ActivityCardProps {
  activity: ActivityWithRelations;
  showActions?: boolean;
}

export function ActivityCard({ activity, showActions = true }: ActivityCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
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

  const getRelatedEntityLink = () => {
    if (activity.contact) {
      return (
        <Link href={`/contacts/${activity.contact.id}`} className="text-blue-600 hover:underline">
          {activity.contact.first_name} {activity.contact.last_name}
        </Link>
      );
    }
    if (activity.company) {
      return (
        <Link href={`/companies/${activity.company.id}`} className="text-blue-600 hover:underline">
          {activity.company.name}
        </Link>
      );
    }
    if (activity.deal) {
      return (
        <Link href={`/deals/${activity.deal.id}`} className="text-blue-600 hover:underline">
          {activity.deal.title}
        </Link>
      );
    }
    return null;
  };

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Activity Icon */}
        <div className="flex-shrink-0">
          <ActivityIcon type={activity.type} size="lg" />
        </div>

        {/* Activity Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900 truncate">{activity.title}</h4>
            <Badge className={getStatusColor(activity.status)}>
              {activity.status}
            </Badge>
          </div>

          {activity.description && (
            <p className="text-gray-600 text-sm mb-2 line-clamp-2">
              {activity.description}
            </p>
          )}

          {/* Related Entity */}
          {getRelatedEntityLink() && (
            <p className="text-sm text-gray-500 mb-2">
              Related to: {getRelatedEntityLink()}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-500">
            <span>{formatDate(activity.created_at)}</span>
            
            {activity.duration_minutes && (
              <span>{activity.duration_minutes} min</span>
            )}
            
            {activity.location && (
              <span>📍 {activity.location}</span>
            )}
            
            {activity.attendees && activity.attendees.length > 0 && (
              <span>👥 {activity.attendees.length} attendees</span>
            )}
            
            {activity.due_date && (
              <span>⏰ Due: {formatDate(activity.due_date)}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex-shrink-0">
            <Link href={`/activities/${activity.id}`}>
              <button className="text-sm text-blue-600 hover:text-blue-800">
                View →
              </button>
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}