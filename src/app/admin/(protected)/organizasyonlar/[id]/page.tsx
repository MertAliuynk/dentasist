import { redirect } from "next/navigation";
import { auth } from "@/server/platform-auth";
import { OrganizationDetailClient } from "@/components/platform/organization-detail-client";
import { DETAIL_TABS, type DetailTab } from "@/components/platform/detail-tabs";

export default async function PlatformOrganizationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sekme?: string; hatalar?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const session = await auth();
  if (!session?.platformUser) redirect("/admin/giris");

  const initialTab: DetailTab = DETAIL_TABS.includes(query.sekme as DetailTab) ? (query.sekme as DetailTab) : "genel";

  return (
    <OrganizationDetailClient
      organizationId={id}
      role={session.platformUser.role}
      initialTab={initialTab}
      initialOnlyErrors={query.hatalar === "1"}
    />
  );
}
