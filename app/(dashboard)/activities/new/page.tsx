import { redirect } from "next/navigation";
import ActivityForm from "@/components/forms/activity-form";

export const dynamic = "force-dynamic";

export default async function NewActivityPage({
  searchParams,
}: {
  searchParams: Promise<{
    contact_id?: string;
    company_id?: string;
    deal_id?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">New Activity</h1>
        <p className="text-gray-600 mt-1">Log a new interaction or task</p>
      </div>

      <ActivityForm
        contactId={resolvedSearchParams.contact_id}
        companyId={resolvedSearchParams.company_id}
        dealId={resolvedSearchParams.deal_id}
        onSuccess={() => redirect("/activities")}
      />
    </div>
  );
}
