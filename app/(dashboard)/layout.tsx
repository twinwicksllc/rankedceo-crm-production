import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureCrmProfile } from "@/lib/supabase/ensure-crm-profile";
import { DashboardNav } from "@/components/dashboard-nav";
import { SidebarLogo } from "@/components/ui/sidebar-logo";
import { LogOut } from "lucide-react";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Make sure this login has a CRM profile and an owning account. New
  // signups otherwise land in auth.users with no public.users row, and the
  // dashboard then shows "Account Setup Required". Idempotent, never throws.
  const profile = await ensureCrmProfile({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
  });
  if (!profile.ok) {
    console.error(
      "[Dashboard Layout] ensureCrmProfile failed:",
      profile.reason,
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Dynamic logo: industry brand on subdomain, RankedCEO on main CRM */}
        <SidebarLogo />

        <DashboardNav />

        <div className="p-4 border-t border-gray-200">
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="flex items-center w-full px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
