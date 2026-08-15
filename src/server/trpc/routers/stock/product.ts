import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

export const stockProductRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read")).query(({ ctx }) => {
    return ctx.db.stockProduct.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
      },
      include: { category: true, supplier: true, branch: true },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(
      z.object({
        branchId: z.string(),
        name: z.string().trim().min(1).max(160),
        unit: z.string().trim().min(1).max(20).default("adet"),
        categoryId: z.string().optional(),
        supplierId: z.string().optional(),
        quantity: z.number().int().min(0).default(0),
        criticalLevel: z.number().int().min(0).default(0),
        unitPrice: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const organizationId = ctx.session.user.organizationId;

      const [category, supplier] = await Promise.all([
        input.categoryId
          ? ctx.db.stockCategory.findFirst({ where: { id: input.categoryId, organizationId, deletedAt: null } })
          : null,
        input.supplierId
          ? ctx.db.supplier.findFirst({ where: { id: input.supplierId, organizationId, deletedAt: null } })
          : null,
      ]);
      if (input.categoryId && !category) throw new TRPCError({ code: "NOT_FOUND", message: "Kategori bulunamadı." });
      if (input.supplierId && !supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Tedarikçi bulunamadı." });

      return ctx.db.stockProduct.create({
        data: {
          organizationId,
          branchId: input.branchId,
          name: input.name,
          unit: input.unit,
          categoryId: input.categoryId || null,
          supplierId: input.supplierId || null,
          quantity: input.quantity,
          criticalLevel: input.criticalLevel,
          unitPrice: input.unitPrice ?? null,
        },
      });
    }),

  update: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(160).optional(),
        unit: z.string().trim().min(1).max(20).optional(),
        categoryId: z.string().nullable().optional(),
        supplierId: z.string().nullable().optional(),
        criticalLevel: z.number().int().min(0).optional(),
        unitPrice: z.number().int().min(0).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const { count } = await ctx.db.stockProduct.updateMany({
        where: { id, organizationId: ctx.session.user.organizationId },
        data,
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.stockProduct.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
