import { z } from "zod";
import {
  platformRouter,
  platformProcedure,
  requirePlatformCapability,
  logPlatformAction,
} from "@/server/trpc/platform-trpc";

export const platformPlanRouter = platformRouter({
  list: platformProcedure.use(requirePlatformCapability("platform:org:read")).query(({ ctx }) => {
    return ctx.db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  }),

  update: platformProcedure
    .use(requirePlatformCapability("platform:plan:manage"))
    .input(
      z.object({
        id: z.string(),
        priceMonthly: z.number().int().min(0).optional(),
        isActive: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.plan.update({
        where: { id: input.id },
        data: {
          ...(input.priceMonthly !== undefined ? { priceMonthly: input.priceMonthly } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "plan.updated", {
        entityType: "Plan",
        entityId: plan.id,
        diff: input,
      });
      return plan;
    }),
});
