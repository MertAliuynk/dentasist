import NextAuth from "next-auth";
import { authConfig } from "@/server/auth.config";

// Used only by middleware.ts (Edge runtime). Reads/verifies the JWT
// cookie and shapes `session.user` from its claims — never touches
// Prisma. The full DB-backed config lives in src/server/auth.ts.
export const { auth } = NextAuth(authConfig);
