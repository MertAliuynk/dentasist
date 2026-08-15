import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const supplierRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read")).query(({ ctx }) => {
    return ctx.db.supplier.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        phone: z.string().trim().max(30).optional(),
        email: z.string().trim().email().optional().or(z.literal("")),
        address: z.string().trim().max(300).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.supplier.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          name: input.name,
          phone: input.phone || null,
          email: input.email || null,
          address: input.address || null,
        },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:stock:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.supplier.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
