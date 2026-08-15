import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

export const followUpRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ status: z.enum(["PENDING", "DONE"]).optional() }))
    .query(({ ctx, input }) => {
      return ctx.db.followUp.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          ...(input.status ? { status: input.status } : {}),
        },
        include: { patient: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(
      z.object({
        patientId: z.string(),
        branchId: z.string(),
        reason: z.string().trim().min(2).max(200),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);

      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.patientId,
          branchId: input.branchId,
          organizationId: ctx.session.user.organizationId,
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });

      return ctx.db.followUp.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          branchId: input.branchId,
          patientId: input.patientId,
          reason: input.reason,
          note: input.note || null,
          createdByUserId: ctx.session.user.id,
        },
      });
    }),

  resolve: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(z.object({ id: z.string(), note: z.string().trim().max(2000).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.followUp.updateMany({
        where: {
          id: input.id,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        data: {
          status: "DONE",
          resolvedAt: new Date(),
          ...(input.note ? { note: input.note } : {}),
        },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
});
