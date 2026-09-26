import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

const readProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read"));
const manageProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:manage"));
const name = z.string().trim().min(1, "Kategori adı gerekli.").max(80);

export const stockCategoryRouter = router({
  list: readProc.query(({ ctx }) =>
    ctx.db.stockCategory.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
    }),
  ),

  create: manageProc.input(z.object({ name })).mutation(({ ctx, input }) =>
    ctx.db.stockCategory.create({ data: { organizationId: ctx.session.user.organizationId, name: input.name } }),
  ),

  update: manageProc.input(z.object({ id: z.string(), name })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.stockCategory.updateMany({
      where: { id: input.id, organizationId: ctx.session.user.organizationId, deletedAt: null },
      data: { name: input.name },
    });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Kategori bulunamadı." });
    return { success: true };
  }),

  // Products keep existing but become "kategorisiz".
  delete: manageProc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const organizationId = ctx.session.user.organizationId;
    await ctx.db.$transaction([
      ctx.db.stockProduct.updateMany({ where: { organizationId, categoryId: input.id }, data: { categoryId: null } }),
      ctx.db.stockCategory.updateMany({ where: { id: input.id, organizationId }, data: { deletedAt: new Date() } }),
    ]);
    return { success: true };
  }),
});
