import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";

/**
 * Edge-safe subset of the platform Auth.js config — mirrors
 * src/server/auth.config.ts but is a fully separate instance: different
 * secret, different cookie names, different underlying user table
 * (PlatformUser, not User). Nothing here ever touches Prisma so it's safe
 * to import from proxy.ts (Edge runtime).
 */
const COOKIE_PREFIX = "platform-admin";

export const platformAuthConfig = {
  basePath: "/api/platform-auth",
  pages: { signIn: "/admin/giris" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  secret: process.env.PLATFORM_AUTH_SECRET,
  trustHost: true,
  providers: [],
  cookies: {
    sessionToken: { name: `${COOKIE_PREFIX}.session-token` },
    callbackUrl: { name: `${COOKIE_PREFIX}.callback-url` },
    csrfToken: { name: `${COOKIE_PREFIX}.csrf-token` },
  },
  callbacks: {
    session: ({ session, token }: { session: Session; token: JWT }) => {
      if (!token.sub) return session;
      session.platformUser = {
        id: token.sub,
        name: (token.name as string) ?? "",
        email: (token.email as string) ?? "",
        role: (token.platformRole as "OWNER" | "DEVELOPER" | "SUPPORT") ?? "SUPPORT",
      };
      return session;
    },
  },
} satisfies NextAuthConfig;
