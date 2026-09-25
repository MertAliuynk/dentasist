import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Edge-safe subset of the Auth.js config: no Prisma import, no providers
 * that touch the database. Shared between the full (Node.js) config used
 * by route handlers/tRPC and the lightweight edge config used by
 * middleware, so the `session` shape stays identical in both places.
 */
export const authConfig = {
  pages: { signIn: "/giris" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  trustHost: true,
  providers: [],
  callbacks: {
    session: ({ session, token }: { session: Session; token: JWT }) => {
      if (!token.sub) return session;
      session.user.id = token.sub;
      session.user.organizationId = (token.organizationId as string) ?? "";
      session.user.organizationName = (token.organizationName as string) ?? "";
      session.user.memberships = token.memberships ?? [];
      session.user.entitlements = token.entitlements ?? [];
      session.user.capabilityOverrides = token.capabilityOverrides ?? [];
      session.user.subscription = token.subscription ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
