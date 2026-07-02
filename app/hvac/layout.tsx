import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "HVAC Pro — Heating, Cooling & Air Quality Services",
  description:
    "HVAC service request management for heating and cooling professionals",
};

/**
 * HVAC Pro Layout
 *
 * Protects /hvac routes: only accessible via hvac.rankedceo.com subdomain.
 * Direct access to /hvac from the main domain redirects to /.
 */
export default async function HvacLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersObj = await headers();
  const hostname = headersObj.get("host") || "";

  const host = hostname.split(":")[0];
  const parts = host.split(".");

  let isHvacSubdomain = false;

  if (parts.length === 2 && parts[1] === "localhost") {
    isHvacSubdomain = parts[0] === "hvac";
  } else if (parts.length > 2) {
    isHvacSubdomain = parts[0] === "hvac";
  }

  if (!isHvacSubdomain) {
    redirect("/");
  }

  return <>{children}</>;
}
