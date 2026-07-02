import { redirect } from "next/navigation";

// crm.rankedceo.com root → send straight to login.
// The SmilePro marketing landing page belongs at smile.rankedceo.com only.
export default function HomePage() {
  redirect("/login");
}
