import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import { authConfig } from "@/server/auth.config";
import { checkRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/get-client-ip";
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

export type SessionCapabilityOverride = {
  capability: string;
  effect: "GRANT" | "REVOKE";
};

// Credentials provider requires JWT sessions (Auth.js cannot attach a
// database session to a provider that has no real "account" to link).
// The DB-backed jwt callback below only runs in Node.js contexts (route
// handlers, RSC, tRPC context) — it populates role/entitlement claims
// once at sign-in. Middleware (Edge runtime) reads those claims back out
// of the JWT via the shared `session` callback in auth.config.ts without
// ever touching Prisma. Role/entitlement changes take effect on next
// sign-in (session maxAge is capped at 8h); revoking a deleted user is
// enforced by every protected tRPC procedure re-checking `deletedAt`
// is out of scope for read-only session claims, so critical mutations
// should still authorize against fresh DB state, not just the token.
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
        if (!user || !user.passwordHash || user.deletedAt) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (!user) return token;

      const dbUser = await db.user.findUnique({
        where: { id: user.id },
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
      token.entitlements = (dbUser.organization.subscription?.entitlements ?? []).map(
        (e) => ({ module: e.module, active: e.active }),
      ) satisfies SessionEntitlement[];
      token.capabilityOverrides = dbUser.capabilityOverrides satisfies SessionCapabilityOverride[];

      return token;
    },
  },
});
