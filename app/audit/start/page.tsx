import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPlacesAvailable } from "@/lib/waas/services/audit-engine/local-pack";
import { AuditStartForm } from "./audit-start-form";

export default async function AuditStartPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/audit/start");
  }

  // When the local-pack lookup is on, the engine finds competitors itself and
  // the visitor may leave the competitor fields blank.
  const discoveryAvailable = isPlacesAvailable(
    process.env.WAAS_SEO_PROVIDER ?? "serper",
  );

  return <AuditStartForm discoveryAvailable={discoveryAvailable} />;
}
