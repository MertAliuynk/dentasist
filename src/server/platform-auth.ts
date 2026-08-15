import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/server/db";
import { platformAuthConfig } from "@/server/platform-auth.config";
import { checkRateLimit } from "@/server/security/rate-limit";
import { getClientIp } from "@/server/security/get-client-ip";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Deliberately no PrismaAdapter: Credentials + JWT doesn't need database
// session persistence, and NOT wiring PlatformUser into an adapter means
// this table can never be touched by anything except this file and the
// platform tRPC routers — one less surface for a tenant-side bug to reach.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...platformAuthConfig,
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
        const byIp = checkRateLimit(`platform-login:ip:${ip}`, 15, 15 * 60 * 1000);
        const byEmail = checkRateLimit(`platform-login:email:${email.toLowerCase()}`, 5, 15 * 60 * 1000);
        if (!byIp.allowed || !byEmail.allowed) return null;

        const platformUser = await db.platformUser.findUnique({ where: { email } });
        if (!platformUser || platformUser.deletedAt) return null;

        const valid = await bcrypt.compare(password, platformUser.passwordHash);
        if (!valid) return null;

        return { id: platformUser.id, email: platformUser.email, name: platformUser.name };
      },
    }),
  ],
  callbacks: {
    ...platformAuthConfig.callbacks,
    jwt: async ({ token, user }) => {
      if (!user) return token;

      const platformUser = await db.platformUser.findUnique({ where: { id: user.id } });
      if (!platformUser || platformUser.deletedAt) return {};

      token.name = platformUser.name;
      token.email = platformUser.email;
      token.platformRole = platformUser.role;
      return token;
    },
  },
});
