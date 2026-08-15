import { auth } from "@/server/platform-auth";
import { db } from "@/server/db";

export async function createPlatformTRPCContext() {
  const session = await auth();
  return { db, session };
}

export type PlatformTRPCContext = Awaited<ReturnType<typeof createPlatformTRPCContext>>;
