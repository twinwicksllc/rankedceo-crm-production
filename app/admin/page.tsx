import { redirect } from 'next/navigation'

// /admin has no content — redirect to the main dashboard.
// The admin layout handles auth protection for all /admin/* routes.
export default function AdminRootPage() {
  redirect('/admin/dashboard')
}
