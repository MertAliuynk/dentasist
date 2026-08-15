import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

function dayRange(dateStr: string) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export const labCashRouter = router({
  listByDate: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:cash:read"))
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const { start, end } = dayRange(input.date);
      const entries = await ctx.db.labCashEntry.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          entryDate: { gte: start, lte: end },
        },
        include: { category: true },
        orderBy: { createdAt: "desc" },
      });

      const income = entries.filter((e) => e.type === "GELIR");
      const expense = entries.filter((e) => e.type === "GIDER");
      return { income, expense };
    }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:cash:write"))
    .input(
      z.object({
        branchId: z.string(),
        type: z.enum(["GELIR", "GIDER"]),
        amount: z.number().int().min(1),
        categoryId: z.string().optional(),
        description: z.string().trim().max(300).optional(),
        entryDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const organizationId = ctx.session.user.organizationId;

      if (input.categoryId) {
        const category = await ctx.db.labExpenseCategory.findFirst({
          where: { id: input.categoryId, organizationId, deletedAt: null },
        });
        if (!category) throw new TRPCError({ code: "NOT_FOUND", message: "Gider kalemi bulunamadı." });
      }

      return ctx.db.labCashEntry.create({
        data: {
          organizationId,
          branchId: input.branchId,
          type: input.type,
          amount: input.amount,
          categoryId: input.categoryId || null,
          description: input.description || null,
          entryDate: new Date(input.entryDate),
          createdByUserId: ctx.session.user.id,
        },
      });
    }),
});
