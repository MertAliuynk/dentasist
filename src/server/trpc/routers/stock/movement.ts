import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

export const stockMovementRouter = router({
  // "Stok Hareketleri" — every movement, optionally filtered.
  list: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:read"))
    .input(
      z.object({
        productId: z.string().optional(),
        type: z.enum(["GIRIS", "CIKIS"]).optional(),
        // "Ürün Kullanımları" is just CIKIS movements with a patient attached
        // — reuse the same table/shape instead of a parallel model.
        onlyPatientUsage: z.boolean().optional(),
        limit: z.number().int().min(1).max(200).default(100),
      }),
    )
    .query(({ ctx, input }) => {
      return ctx.db.stockMovement.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          ...(input.productId ? { productId: input.productId } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(input.onlyPatientUsage ? { patientId: { not: null } } : {}),
        },
        include: { product: true, branch: true, patient: true },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:write"))
    .input(
      z.object({
        productId: z.string(),
        branchId: z.string(),
        type: z.enum(["GIRIS", "CIKIS"]),
        quantity: z.number().int().min(1),
        patientId: z.string().optional(),
        note: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const organizationId = ctx.session.user.organizationId;

      const product = await ctx.db.stockProduct.findFirst({
        where: { id: input.productId, organizationId, branchId: input.branchId, deletedAt: null },
      });
      if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Ürün bulunamadı." });

      if (input.patientId) {
        const patient = await ctx.db.patient.findFirst({
          where: { id: input.patientId, deletedAt: null, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
          select: { id: true },
        });
        if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });
      }

      const delta = input.type === "GIRIS" ? input.quantity : -input.quantity;
      if (product.quantity + delta < 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Stok miktarı negatif olamaz." });
      }

      return ctx.db.$transaction(async (tx) => {
        await tx.stockProduct.update({ where: { id: product.id }, data: { quantity: { increment: delta } } });
        return tx.stockMovement.create({
          data: {
            organizationId,
            productId: product.id,
            branchId: input.branchId,
            type: input.type,
            quantity: input.quantity,
            patientId: input.patientId || null,
            note: input.note || null,
            createdByUserId: ctx.session.user.id,
          },
        });
      });
    }),
});
