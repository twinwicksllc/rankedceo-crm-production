import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Spark Pro — Electrical Installation & Repair Services",
  description:
    "Electrical service request management for licensed electricians",
};

export default async function ElectricalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersObj = await headers();
  const hostname = headersObj.get("host") || "";
  const host = hostname.split(":")[0];
  const parts = host.split(".");

  let isElectricalSubdomain = false;
  if (parts.length === 2 && parts[1] === "localhost") {
    isElectricalSubdomain = parts[0] === "electrical";
  } else if (parts.length > 2) {
    isElectricalSubdomain = parts[0] === "electrical";
  }

  if (!isElectricalSubdomain) redirect("/");

  return <>{children}</>;
}
