import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getClientIp } from "@/server/security/get-client-ip";

export async function createTRPCContext({ req }: { req: Request }) {
  const session = await auth();
  return { db, session, clientIp: getClientIp(req) };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;
