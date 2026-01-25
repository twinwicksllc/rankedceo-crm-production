import { notFound } from 'next/navigation';
import { contactService } from '@/lib/services/contact-service';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityTimeline } from '@/components/activities/activity-timeline';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

async function getContactActivities(contactId: string) {
  const response = await fetch(`/api/activities?contact_id=${contactId}`, {
    cache: 'no-store',
  });
  
  if (!response.ok) {
    return [];
  }
  
  return response.json();
}

export default async function ContactDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [contact, activities] = await Promise.all([
    contactService.getContactById(params.id),
    getContactActivities(params.id),
  ]);

  if (!contact) {
    notFound();
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Link href="/contacts" className="text-blue-600 hover:underline text-sm">
            ← Back to Contacts
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {contact.first_name} {contact.last_name}
          </h1>
          <div className="flex items-center gap-3 mt-2">
            <Badge className={
              contact.status === 'active' ? 'bg-green-100 text-green-800' : 
              contact.status === 'inactive' ? 'bg-gray-100 text-gray-800' : 
              'bg-blue-100 text-blue-800'
            }>
              {contact.status}
            </Badge>
            <span className="text-gray-600">
              Contact since {formatDate(contact.created_at)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/contacts/${contact.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <Link href={`/activities/new?contact_id=${contact.id}`}>
            <Button>+ Log Activity</Button>
          </Link>
        </div>
      </div>

      {/* Contact Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Email</div>
                <div className="font-medium">{contact.email || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Phone</div>
                <div className="font-medium">{contact.phone || 'N/A'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Company</div>
                <div className="font-medium">
                  {contact.company_id ? (
                    <Link href={`/companies/${contact.company_id}`} className="text-blue-600 hover:underline">
                      View Company
                    </Link>
                  ) : 'N/A'}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Job Title</div>
                <div className="font-medium">{contact.job_title || 'N/A'}</div>
              </div>
            </div>
          </Card>

          {/* Notes */}
          {contact.notes && (
            <Card className="p-6">
              <h3 className="font-semibold mb-3">Notes</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{contact.notes}</p>
            </Card>
          )}

          {/* Activity Timeline */}
          <ActivityTimeline
            title="Activity History"
            activities={activities}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <Link href={`/activities/new?contact_id=${contact.id}&type=call`}>
                <Button variant="outline" className="w-full justify-start">
                  📞 Log Call
                </Button>
              </Link>
              <Link href={`/activities/new?contact_id=${contact.id}&type=meeting`}>
                <Button variant="outline" className="w-full justify-start">
                  📅 Schedule Meeting
                </Button>
              </Link>
              <Link href={`/activities/new?contact_id=${contact.id}&type=email`}>
                <Button variant="outline" className="w-full justify-start">
                  📧 Send Email
                </Button>
              </Link>
              <Link href={`/activities/new?contact_id=${contact.id}&type=task`}>
                <Button variant="outline" className="w-full justify-start">
                  ✅ Add Task
                </Button>
              </Link>
            </div>
          </Card>

          {/* Metadata */}
          <Card className="p-6">
            <h3 className="font-semibold mb-3">Details</h3>
            <div className="space-y-3">
              <div>
                <div className="text-sm text-gray-600">Created</div>
                <div className="text-sm">{formatDate(contact.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Last Updated</div>
                <div className="text-sm">{formatDate(contact.updated_at)}</div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}