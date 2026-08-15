import { z } from "zod";
import { platformRouter, platformProcedure, requirePlatformCapability, logPlatformAction } from "@/server/trpc/platform-trpc";

// Pricing policy, same capability gate as Planlar (OWNER-only).
export const platformDiscountCodeRouter = platformRouter({
  list: platformProcedure.use(requirePlatformCapability("platform:plan:manage")).query(({ ctx }) => {
    return ctx.db.discountCode.findMany({ orderBy: { createdAt: "desc" } });
  }),

  create: platformProcedure
    .use(requirePlatformCapability("platform:plan:manage"))
    .input(
      z.object({
        code: z.string().trim().min(3).max(40).toUpperCase(),
        type: z.enum(["PERCENT", "AMOUNT"]),
        value: z.number().int().min(1),
        maxUses: z.number().int().min(1).optional(),
        expiresAt: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.discountCode.create({
        data: {
          code: input.code,
          type: input.type,
          value: input.value,
          maxUses: input.maxUses ?? null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "discount_code.created", {
        entityType: "DiscountCode",
        entityId: created.id,
        diff: input,
      });
      return created;
    }),

  toggle: platformProcedure
    .use(requirePlatformCapability("platform:plan:manage"))
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.discountCode.update({ where: { id: input.id }, data: { active: input.active } });
      await logPlatformAction(ctx.db, ctx.platformUser.id, "discount_code.toggled", {
        entityType: "DiscountCode",
        entityId: input.id,
        diff: { active: input.active },
      });
      return updated;
    }),
});
