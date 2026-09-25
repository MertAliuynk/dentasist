import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { PlatformTRPCContext } from "@/server/trpc/platform-context";
import { hasPlatformCapability, alwaysSeesSensitiveData, type PlatformCapability } from "@/server/rbac/platform-permissions";
import { checkRateLimit } from "@/server/security/rate-limit";

const t = initTRPC.context<PlatformTRPCContext>().create({ transformer: superjson });

export const platformRouter = t.router;
export const platformPublicProcedure = t.procedure;

export const platformProcedure = t.procedure.use(({ ctx, type, next }) => {
  if (!ctx.session?.platformUser) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (type === "mutation") {
    const { allowed, retryAfterMs } = checkRateLimit(`platform-mutation:${ctx.session.platformUser.id}`, 120, 60 * 1000);
    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Çok fazla istek gönderildi. Lütfen ${Math.ceil(retryAfterMs / 1000)} saniye sonra tekrar deneyin.`,
      });
    }
  }
  return next({ ctx: { ...ctx, platformUser: ctx.session.platformUser } });
});

export function requirePlatformCapability(capability: PlatformCapability) {
  return t.middleware(({ ctx, next }) => {
    const platformUser = ctx.session?.platformUser;
    if (!platformUser || !hasPlatformCapability(platformUser.role, capability)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx: { ...ctx, platformUser } });
  });
}

/** Throws unless the caller is OWNER/DEVELOPER or holds an active SupportAccessGrant for this org. */
export async function assertSensitiveOrgAccess(ctx: PlatformTRPCContext, organizationId: string) {
  const platformUser = ctx.session?.platformUser;
  if (!platformUser) throw new TRPCError({ code: "UNAUTHORIZED" });
  if (alwaysSeesSensitiveData(platformUser.role)) return;

  const grant = await ctx.db.supportAccessGrant.findFirst({
    where: { organizationId, grantedToId: platformUser.id, expiresAt: { gt: new Date() } },
  });
  if (!grant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Bu klinik için hassas verilere erişim yetkiniz yok. Owner/Developer'dan geçici erişim isteyin.",
    });
  }
}

export async function logPlatformAction(
  db: PlatformTRPCContext["db"],
  actorId: string,
  action: string,
  extra?: { organizationId?: string; entityType?: string; entityId?: string; diff?: object },
) {
  await db.platformAuditLog.create({
    data: {
      actorId,
      action,
      organizationId: extra?.organizationId,
      entityType: extra?.entityType,
      entityId: extra?.entityId,
      diff: extra?.diff ? JSON.parse(JSON.stringify(extra.diff)) : undefined,
    },
  });
}
