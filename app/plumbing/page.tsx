import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PlumbingDashboard from "./plumbing-dashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlumbingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: userData } = await supabase
    .from("users")
    .select("account_id")
    .eq("id", user.id)
    .single();

  const { count } = await supabase
    .from("industry_leads")
    .select("*", { count: "exact", head: true })
    .eq("account_id", userData?.account_id ?? "")
    .eq("industry", "plumbing");

  return <PlumbingDashboard userId={user.id} leadCount={count || 0} />;
}
