import type { SessionEntitlement } from "@/server/auth";

const MODULE_META: Record<SessionEntitlement["module"], { href: string; label: string }> = {
  DENTAL: { href: "/dental", label: "Dental" },
  MUHASEBE: { href: "/muhasebe", label: "Muhasebe" },
  LABORATUVAR: { href: "/laboratuvar", label: "Laboratuvar" },
};

export function resolveOtherModules(
  entitlements: SessionEntitlement[],
  currentModule: SessionEntitlement["module"],
) {
  return entitlements.filter((e) => e.active && e.module !== currentModule).map((e) => MODULE_META[e.module]);
}
