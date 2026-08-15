import type { PlatformRole } from "@prisma/client";

export type PlatformCapability =
  | "platform:org:read"
  | "platform:org:manage"
  | "platform:staff:manage"
  | "platform:grant:manage"
  | "platform:audit:read"
  | "platform:plan:manage"
  | "platform:support:respond";

const OWNER: PlatformCapability[] = [
  "platform:org:read",
  "platform:org:manage",
  "platform:staff:manage",
  "platform:grant:manage",
  "platform:audit:read",
  "platform:plan:manage",
  "platform:support:respond",
];

const DEVELOPER: PlatformCapability[] = [
  "platform:org:read",
  "platform:org:manage",
  "platform:grant:manage",
  "platform:audit:read",
  "platform:support:respond",
];

const SUPPORT: PlatformCapability[] = ["platform:org:read", "platform:support:respond"];

export const PLATFORM_ROLE_CAPABILITIES: Record<PlatformRole, PlatformCapability[]> = {
  OWNER,
  DEVELOPER,
  SUPPORT,
};

export function hasPlatformCapability(role: PlatformRole, capability: PlatformCapability): boolean {
  return PLATFORM_ROLE_CAPABILITIES[role].includes(capability);
}

/** OWNER and DEVELOPER always see sensitive (patient/financial) data; SUPPORT needs an active grant, checked separately. */
export function alwaysSeesSensitiveData(role: PlatformRole): boolean {
  return role === "OWNER" || role === "DEVELOPER";
}
