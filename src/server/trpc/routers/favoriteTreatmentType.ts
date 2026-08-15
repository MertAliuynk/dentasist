import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement } from "@/server/trpc/trpc";

export const favoriteTreatmentTypeRouter = router({
  list: protectedProcedure.use(requireEntitlement("DENTAL")).query(async ({ ctx }) => {
    const favorites = await ctx.db.userFavoriteTreatmentType.findMany({
      where: { userId: ctx.session.user.id },
      select: { treatmentTypeId: true },
    });
    return favorites.map((f) => f.treatmentTypeId);
  }),

  toggle: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ treatmentTypeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const treatmentType = await ctx.db.treatmentType.findFirst({
        where: { id: input.treatmentTypeId, organizationId: ctx.session.user.organizationId, deletedAt: null },
      });
      if (!treatmentType) throw new TRPCError({ code: "NOT_FOUND" });

      const existing = await ctx.db.userFavoriteTreatmentType.findUnique({
        where: { userId_treatmentTypeId: { userId: ctx.session.user.id, treatmentTypeId: input.treatmentTypeId } },
      });

      if (existing) {
        await ctx.db.userFavoriteTreatmentType.delete({ where: { id: existing.id } });
        return { favorited: false };
      }

      await ctx.db.userFavoriteTreatmentType.create({
        data: { userId: ctx.session.user.id, treatmentTypeId: input.treatmentTypeId },
      });
      return { favorited: true };
    }),
});
