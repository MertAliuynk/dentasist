import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";

export const patientNoteRouter = router({
  list: protectedProcedure.input(z.object({ patientId: z.string() })).query(({ ctx, input }) => {
    return ctx.db.patientNote.findMany({
      where: {
        patientId: input.patientId,
        organizationId: ctx.session.user.organizationId,
        ...(ctx.accessibleBranchIds === "ALL"
          ? {}
          : { patient: { branchId: { in: ctx.accessibleBranchIds } } }),
      },
      include: { author: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({ patientId: z.string(), body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.patientId,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.patientNote.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          patientId: input.patientId,
          authorUserId: ctx.session.user.id,
          body: input.body,
        },
      });
    }),
});
