import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

const readProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read"));
const manageProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:manage"));

const fields = z.object({
  name: z.string().trim().min(1, "Tedarikçi adı gerekli.").max(120),
  contactName: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.union([z.string().trim().email("Geçerli bir e-posta girin."), z.literal("")]).optional(),
  address: z.string().trim().max(300).optional(),
  taxNumber: z.string().trim().max(30).optional(),
  note: z.string().trim().max(500).optional(),
});

const clean = (v: z.infer<typeof fields>) => ({
  name: v.name,
  contactName: v.contactName || null,
  phone: v.phone || null,
  email: v.email || null,
  address: v.address || null,
  taxNumber: v.taxNumber || null,
  note: v.note || null,
});

export const supplierRouter = router({
  list: readProc.query(({ ctx }) =>
    ctx.db.supplier.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
    }),
  ),

  create: manageProc.input(fields).mutation(({ ctx, input }) =>
    ctx.db.supplier.create({ data: { organizationId: ctx.session.user.organizationId, ...clean(input) } }),
  ),

  update: manageProc.input(fields.extend({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const { id, ...rest } = input;
    const { count } = await ctx.db.supplier.updateMany({
      where: { id, organizationId: ctx.session.user.organizationId, deletedAt: null },
      data: clean(rest),
    });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Tedarikçi bulunamadı." });
    return { success: true };
  }),

  delete: manageProc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const organizationId = ctx.session.user.organizationId;
    await ctx.db.$transaction([
      ctx.db.stockProduct.updateMany({ where: { organizationId, supplierId: input.id }, data: { supplierId: null } }),
      ctx.db.supplier.updateMany({ where: { id: input.id, organizationId }, data: { deletedAt: new Date() } }),
    ]);
    return { success: true };
  }),
});
