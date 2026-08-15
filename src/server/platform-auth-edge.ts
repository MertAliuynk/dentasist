import NextAuth from "next-auth";
import { platformAuthConfig } from "@/server/platform-auth.config";

// Used only by proxy.ts (Edge runtime) to protect /admin/** routes.
// Never touches Prisma — just verifies/reads the platform JWT cookie.
export const { auth } = NextAuth(platformAuthConfig);
