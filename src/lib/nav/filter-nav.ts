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

/**
 * Hrefs of nav pages this user may not open (removed by filterNavItems).
 * The shell uses them to show "erişim yok" instead of letting the page fire
 * requests that would all come back FORBIDDEN.
 */
export function blockedNavHrefs(items: NavItem[], roles: GlobalRole[], overrides: CapabilityOverride[] = []): string[] {
  const out: string[] = [];
  const walk = (list: NavItem[], parentBlocked: boolean) => {
    for (const item of list) {
      const blocked =
        parentBlocked ||
        (!!item.patronOnly && !roles.includes("PATRON")) ||
        (!!item.capability && !hasCapability(roles, item.capability, overrides));
      if (blocked && item.href) out.push(item.href);
      if (item.children) walk(item.children, blocked);
    }
  };
  walk(items, false);
  return out;
}
