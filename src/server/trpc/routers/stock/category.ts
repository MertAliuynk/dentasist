import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const stockCategoryRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read")).query(({ ctx }) => {
    return ctx.db.stockCategory.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(z.object({ name: z.string().trim().min(1).max(80) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.stockCategory.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.stockCategory.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
