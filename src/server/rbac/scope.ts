import { TRPCError } from "@trpc/server";
import type { SessionMembership } from "@/server/auth";

export type AccessibleBranches = "ALL" | string[];

/**
 * A membership with branchId === null (Patron) grants access to every
 * branch in the organization. Otherwise access is limited to the
 * branches the user holds a membership in.
 */
export function resolveAccessibleBranchIds(memberships: SessionMembership[]): AccessibleBranches {
  if (memberships.some((m) => m.branchId === null)) return "ALL";
  return [...new Set(memberships.map((m) => m.branchId).filter((id): id is string => id !== null))];
}

/**
 * Spreads into a Prisma `where` clause to enforce tenant + branch scoping.
 * Always derive organizationId/branchIds from ctx.session — never from
 * client input — to prevent cross-tenant data leaks.
 */
export function branchScopeWhere(organizationId: string, accessible: AccessibleBranches) {
  return {
    organizationId,
    ...(accessible === "ALL" ? {} : { branchId: { in: accessible } }),
  };
}

/**
 * Same scoping for the Branch table itself, whose own key is `id` (it has no
 * `branchId` column — using branchScopeWhere on it crashes for every
 * branch-bound role: doctors, secretaries, branch managers).
 */
export function branchSelfWhere(organizationId: string, accessible: AccessibleBranches) {
  return {
    organizationId,
    ...(accessible === "ALL" ? {} : { id: { in: accessible } }),
  };
}

/**
 * Throws FORBIDDEN if the caller does not have access to the given branchId.
 * Use this whenever a mutation accepts a client-supplied branchId, so a
 * branch-restricted role (SUBE_YONETICISI etc.) cannot write into a branch
 * they don't belong to.
 */
export function assertAccessibleBranch(accessible: AccessibleBranches, branchId: string) {
  if (accessible !== "ALL" && !accessible.includes(branchId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Bu şubeye erişiminiz yok." });
  }
}
