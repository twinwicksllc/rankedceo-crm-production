import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Plumb Pro — Plumbing, Drain & Water Services",
  description: "Plumbing service request management for plumbing professionals",
};

export default async function PlumbingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersObj = await headers();
  const hostname = headersObj.get("host") || "";
  const host = hostname.split(":")[0];
  const parts = host.split(".");

  let isPlumbingSubdomain = false;
  if (parts.length === 2 && parts[1] === "localhost") {
    isPlumbingSubdomain = parts[0] === "plumbing";
  } else if (parts.length > 2) {
    isPlumbingSubdomain = parts[0] === "plumbing";
  }

  if (!isPlumbingSubdomain) redirect("/");

  return <>{children}</>;
}
