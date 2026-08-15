import type { SessionMembership } from "@/server/auth";

export function resolveBranchLabel(memberships: SessionMembership[]): string {
  if (memberships.some((m) => m.branchId === null)) return "Tüm Şubeler";
  const names = [...new Set(memberships.map((m) => m.branchName).filter((n): n is string => !!n))];
  return names.length > 0 ? names.join(", ") : "Şube atanmadı";
}
