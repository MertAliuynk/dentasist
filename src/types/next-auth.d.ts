import type { DefaultSession } from "next-auth";
import type {
  SessionEntitlement,
  SessionMembership,
  SessionCapabilityOverride,
  SessionSubscription,
} from "@/server/auth";
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
      /** null only for tokens minted before this claim existed (until their next refresh). */
      subscription: SessionSubscription | null;
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
    subscription?: SessionSubscription;
    platformRole?: PlatformRole;
    /** Epoch ms this token's DB-derived claims were last refreshed — see auth.ts's jwt callback. */
    refreshedAt?: number;
  }
}
