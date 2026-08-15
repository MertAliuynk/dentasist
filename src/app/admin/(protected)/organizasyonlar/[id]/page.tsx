import { redirect } from "next/navigation";
import { auth } from "@/server/platform-auth";
import { OrganizationDetailClient } from "@/components/platform/organization-detail-client";

export default async function PlatformOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.platformUser) redirect("/admin/giris");

  return <OrganizationDetailClient organizationId={id} role={session.platformUser.role} />;
}
