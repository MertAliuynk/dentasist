import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import { authConfig } from "@/server/auth.config";
import { checkRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/get-client-ip";
import { isSubscriptionUsable } from "@/lib/subscription-access";
import { recordActivity } from "@/server/services/activity-log";
import type { GlobalRole } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type SessionMembership = {
  branchId: string | null;
  branchName: string | null;
  role: GlobalRole;
};

export type SessionEntitlement = {
  module: "DENTAL" | "MUHASEBE" | "LABORATUVAR";
  active: boolean;
};

export type SessionSubscription = {
  status: string | null;
  /** ISO string; null = no expiry set. */
  endsAt: string | null;
};

export type SessionCapabilityOverride = {
  capability: string;
  effect: "GRANT" | "REVOKE";
};

// How often the DB-backed jwt callback below re-fetches role/entitlement
// claims for an already-signed-in session, instead of only at sign-in.
// Bounds how stale a session's permissions/subscription state can get —
// previously this only happened at sign-in, so a revoked capability,
// role change, canceled subscription, or deleted account stayed live in
// the token for up to the full 8h session maxAge. 5 minutes trades one
// extra DB read per active user per 5 minutes for a much tighter bound,
// without touching the DB on every single request.
const CLAIMS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

// Credentials provider requires JWT sessions (Auth.js cannot attach a
// database session to a provider that has no real "account" to link).
// The DB-backed jwt callback below only runs in Node.js contexts (route
// handlers, RSC, tRPC context) — it populates role/entitlement claims
// at sign-in and again every CLAIMS_REFRESH_INTERVAL_MS after that (see
// above). Middleware (Edge runtime) reads those claims back out of the
// JWT via the shared `session` callback in auth.config.ts without ever
// touching Prisma — it always sees whatever this callback last wrote,
// so it inherits the same freshness bound. Critical mutations should
// still authorize against fresh DB state regardless, not just the token.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db),
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      authorize: async (raw, request) => {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const ip = getClientIp(request);
        const byIp = checkRateLimit(`login:ip:${ip}`, 20, 15 * 60 * 1000);
        const byEmail = checkRateLimit(`login:email:${email.toLowerCase()}`, 8, 15 * 60 * 1000);
        if (!byIp.allowed || !byEmail.allowed) return null;

        const user = await db.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) return null;

        // Only attempts against a real account are logged (we need its org);
        // unknown e-mails have nowhere to go.
        const logLogin = (ok: boolean, reason?: string) =>
          recordActivity({
            organizationId: user.organizationId,
            userId: user.id,
            userName: user.name,
            path: "auth.login",
            kind: "auth",
            ok,
            errorMessage: reason,
            ip,
          });

        if (user.deletedAt) {
          logLogin(false, "Hesap devre dışı");
          return null;
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          logLogin(false, "Hatalı şifre");
          return null;
        }

        logLogin(true);
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      const userId = user?.id ?? token.sub;
      if (!userId) return token;

      // Refresh at sign-in (user present) and periodically after that;
      // otherwise reuse the already-fresh-enough token as-is.
      const isStale = typeof token.refreshedAt !== "number" || Date.now() - token.refreshedAt > CLAIMS_REFRESH_INTERVAL_MS;
      if (!user && !isStale) return token;

      const dbUser = await db.user.findUnique({
        where: { id: userId },
        include: {
          memberships: { select: { branchId: true, role: true, branch: { select: { name: true } } } },
          capabilityOverrides: { select: { capability: true, effect: true } },
          organization: {
            include: {
              subscription: { include: { entitlements: true } },
            },
          },
        },
      });

      if (!dbUser || dbUser.deletedAt) return {};

      token.organizationId = dbUser.organizationId;
      token.organizationName = dbUser.organization.name;
      token.name = dbUser.name;
      token.email = dbUser.email;
      token.memberships = dbUser.memberships.map((m) => ({
        branchId: m.branchId,
        branchName: m.branch?.name ?? null,
        role: m.role,
      })) satisfies SessionMembership[];
      const subscription = dbUser.organization.subscription;
      const usable = isSubscriptionUsable(subscription?.status, subscription?.currentPeriodEnd);
      token.entitlements = (subscription?.entitlements ?? []).map(
        (e) => ({ module: e.module, active: e.active && usable }),
      ) satisfies SessionEntitlement[];
      token.subscription = {
        status: subscription?.status ?? null,
        endsAt: subscription?.currentPeriodEnd?.toISOString() ?? null,
      } satisfies SessionSubscription;
      token.capabilityOverrides = dbUser.capabilityOverrides satisfies SessionCapabilityOverride[];
      token.refreshedAt = Date.now();

      return token;
    },
  },
});
