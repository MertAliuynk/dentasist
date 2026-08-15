import type { GlobalRole } from "@prisma/client";
import { hasCapability, type CapabilityOverride } from "@/server/rbac/permissions";
import type { NavItem } from "@/lib/nav/types";

export function filterNavItems(
  items: NavItem[],
  roles: GlobalRole[],
  overrides: CapabilityOverride[] = [],
): NavItem[] {
  return items
    .filter((item) => {
      if (item.patronOnly && !roles.includes("PATRON")) return false;
      if (item.capability && !hasCapability(roles, item.capability, overrides)) return false;
      return true;
    })
    .map((item) => (item.children ? { ...item, children: filterNavItems(item.children, roles, overrides) } : item))
    // A group with every child filtered out has nothing left to show.
    .filter((item) => !item.children || item.children.length > 0);
}
