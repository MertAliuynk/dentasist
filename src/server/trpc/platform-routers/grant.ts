import { z } from "zod";
import {
  platformRouter,
  platformProcedure,
  requirePlatformCapability,
  logPlatformAction,
} from "@/server/trpc/platform-trpc";

export const platformGrantRouter = platformRouter({
  listForOrg: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(z.object({ organizationId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.supportAccessGrant.findMany({
        where: { organizationId: input.organizationId },
        include: { grantedTo: true, grantedBy: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
    }),

  issue: platformProcedure
    .use(requirePlatformCapability("platform:grant:manage"))
    .input(
      z.object({
        organizationId: z.string(),
        grantedToId: z.string(),
        hours: z.number().int().min(1).max(168).default(24),
        reason: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = new Date(Date.now() + input.hours * 60 * 60 * 1000);
      const grant = await ctx.db.supportAccessGrant.create({
        data: {
          organizationId: input.organizationId,
          grantedToId: input.grantedToId,
          grantedById: ctx.platformUser.id,
          reason: input.reason || null,
          expiresAt,
        },
      });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "grant.issued", {
        organizationId: input.organizationId,
        entityType: "SupportAccessGrant",
        entityId: grant.id,
        diff: { grantedToId: input.grantedToId, hours: input.hours },
      });
      return grant;
    }),

  revoke: platformProcedure
    .use(requirePlatformCapability("platform:grant:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const grant = await ctx.db.supportAccessGrant.update({
        where: { id: input.id },
        data: { expiresAt: new Date() },
      });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "grant.revoked", {
        organizationId: grant.organizationId,
        entityType: "SupportAccessGrant",
        entityId: grant.id,
      });
      return { success: true };
    }),
});
