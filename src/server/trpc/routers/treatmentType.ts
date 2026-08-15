import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

const scopeSchema = z.enum(["DIS_BAZLI", "CENE_BAZLI"]);

export const treatmentTypeRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).query(({ ctx }) => {
    return ctx.db.treatmentType.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      include: { category: true },
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:user:manage"))
    .input(
      z.object({
        name: z.string().trim().min(2).max(120),
        categoryId: z.string().optional(),
        scope: scopeSchema,
        defaultPrice: z.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      if (input.categoryId) {
        const category = await ctx.db.treatmentCategory.findFirst({
          where: { id: input.categoryId, organizationId, deletedAt: null },
        });
        if (!category) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz kategori." });
      }

      return ctx.db.treatmentType.create({
        data: {
          organizationId,
          name: input.name,
          categoryId: input.categoryId || null,
          scope: input.scope,
          defaultPrice: input.defaultPrice ?? null,
        },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:user:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.treatmentType.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { deletedAt: new Date() },
      });
    }),
});
