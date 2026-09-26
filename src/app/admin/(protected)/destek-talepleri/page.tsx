import { redirect } from "next/navigation";
import { auth } from "@/server/platform-auth";
import { SupportTicketsClient } from "@/components/platform/support-tickets-client";

export default async function PlatformSupportTicketsPage({ searchParams }: { searchParams: Promise<{ talep?: string }> }) {
  const session = await auth();
  if (!session?.platformUser) redirect("/admin/giris");
  const { talep } = await searchParams;

  return <SupportTicketsClient initialTicketId={talep} />;
}
