import { z } from "zod";
import { platformRouter, platformProcedure, requirePlatformCapability } from "@/server/trpc/platform-trpc";

export const platformAuditLogRouter = platformRouter({
  list: platformProcedure
    .use(requirePlatformCapability("platform:audit:read"))
    .input(z.object({ organizationId: z.string().optional(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(({ ctx, input }) => {
      return ctx.db.platformAuditLog.findMany({
        where: input.organizationId ? { organizationId: input.organizationId } : undefined,
        include: { actor: true },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),
});
