import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuditStartForm } from "./audit-start-form";

export default async function AuditStartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/audit/start");
  }

  return <AuditStartForm />;
}
