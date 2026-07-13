import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Webpage Audit by Ranked CEO",
  description:
    "Run a fast competitive webpage audit with Ranked CEO to compare SEO, performance, and local visibility.",
};

export default function AuditLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
