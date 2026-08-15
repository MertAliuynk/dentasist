import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const treatmentCategoryRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).query(({ ctx }) => {
    return ctx.db.treatmentCategory.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:user:manage"))
    .input(z.object({ name: z.string().trim().min(2).max(80) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.treatmentCategory.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:user:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.treatmentCategory.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
