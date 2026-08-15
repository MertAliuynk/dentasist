import { z } from "zod";
import { router, protectedProcedure, requireCapability, requireEntitlement } from "@/server/trpc/trpc";

export const expenseCategoryRouter = router({
  list: protectedProcedure.use(requireEntitlement("MUHASEBE")).query(({ ctx }) => {
    return ctx.db.expenseCategory.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("org:expensecategory:manage"))
    .input(z.object({ name: z.string().trim().min(2).max(80) }))
    .mutation(({ ctx, input }) => {
      return ctx.db.expenseCategory.create({
        data: { organizationId: ctx.session.user.organizationId, name: input.name },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("org:expensecategory:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.expenseCategory.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
