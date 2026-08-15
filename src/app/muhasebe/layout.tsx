import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppShell } from "@/components/shared/app-shell";
import { muhasebeNav } from "@/lib/nav/muhasebe-nav";
import { filterNavItems } from "@/lib/nav/filter-nav";
import { ROLE_LABELS } from "@/lib/nav/role-labels";
import { resolveBranchLabel } from "@/lib/nav/branch-label";
import { resolveOtherModules } from "@/lib/nav/other-modules";

export default async function MuhasebeLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const roles = session.user.memberships.map((m) => m.role);
  const navItems = filterNavItems(muhasebeNav, roles, session.user.capabilityOverrides);
  const roleLabel = [...new Set(roles.map((r) => ROLE_LABELS[r]))].join(" / ");

  return (
    <AppShell
      moduleLabel="Muhasebe"
      navItems={navItems}
      organizationName={session.user.organizationName}
      branchLabel={resolveBranchLabel(session.user.memberships)}
      userName={session.user.name ?? session.user.email ?? ""}
      roleLabel={roleLabel}
      otherModules={resolveOtherModules(session.user.entitlements, "MUHASEBE")}
    >
      {children}
    </AppShell>
  );
}
