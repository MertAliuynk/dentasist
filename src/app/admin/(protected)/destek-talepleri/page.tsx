import { redirect } from "next/navigation";
import { auth } from "@/server/platform-auth";
import { SupportTicketsClient } from "@/components/platform/support-tickets-client";

export default async function PlatformSupportTicketsPage() {
  const session = await auth();
  if (!session?.platformUser) redirect("/admin/giris");

  return <SupportTicketsClient />;
}
