import type { DefaultSession } from "next-auth";
import type { SessionEntitlement, SessionMembership, SessionCapabilityOverride } from "@/server/auth";
import type { PlatformRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      organizationName: string;
      memberships: SessionMembership[];
      entitlements: SessionEntitlement[];
      capabilityOverrides: SessionCapabilityOverride[];
    } & DefaultSession["user"];
    platformUser?: {
      id: string;
      name: string;
      email: string;
      role: PlatformRole;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    organizationId?: string;
    organizationName?: string;
    memberships?: SessionMembership[];
    entitlements?: SessionEntitlement[];
    capabilityOverrides?: SessionCapabilityOverride[];
    platformRole?: PlatformRole;
  }
}
