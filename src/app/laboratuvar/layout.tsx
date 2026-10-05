import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppShell } from "@/components/shared/app-shell";
import { labNav, labPrimaryAction } from "@/lib/nav/lab-nav";
import { blockedNavHrefs, filterNavItems } from "@/lib/nav/filter-nav";
import { ROLE_LABELS } from "@/lib/nav/role-labels";
import { resolveBranchLabel } from "@/lib/nav/branch-label";
import { resolveOtherModules } from "@/lib/nav/other-modules";

export default async function LaboratuvarLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/giris");

  const roles = session.user.memberships.map((m) => m.role);
  const navItems = filterNavItems(labNav, roles, session.user.capabilityOverrides);
  const roleLabel = [...new Set(roles.map((r) => ROLE_LABELS[r]))].join(" / ");

  return (
    <AppShell
      moduleLabel="Laboratuvar"
      navItems={navItems}
      blockedHrefs={blockedNavHrefs(labNav, roles, session.user.capabilityOverrides)}
      primaryAction={roles.includes("DOKTOR") || roles.includes("PATRON") ? labPrimaryAction : undefined}
      organizationName={session.user.organizationName}
      branchLabel={resolveBranchLabel(session.user.memberships)}
      userName={session.user.name ?? session.user.email ?? ""}
      roleLabel={roleLabel}
      otherModules={resolveOtherModules(session.user.entitlements, "LABORATUVAR")}
    >
      {children}
    </AppShell>
  );
}
