import { redirect } from 'next/navigation';
import ActivityForm from '@/components/forms/activity-form';

export const dynamic = 'force-dynamic';

export default function NewActivityPage({
  searchParams,
}: {
  searchParams: { contact_id?: string; company_id?: string; deal_id?: string };
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Activity</h1>
        <p className="text-gray-600 mt-1">
          Log a new interaction or task
        </p>
      </div>

      <ActivityForm
        contactId={searchParams.contact_id}
        companyId={searchParams.company_id}
        dealId={searchParams.deal_id}
        onSuccess={() => redirect('/activities')}
      />
    </div>
  );
}