import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

export const appointmentBlockRouter = router({
  listRange: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.appointmentBlock.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          startsAt: { lt: new Date(input.end) },
          endsAt: { gt: new Date(input.start) },
        },
        include: { doctor: { include: { user: true } }, room: true },
        orderBy: { startsAt: "asc" },
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:appointment:write"))
    .input(
      z.object({
        branchId: z.string(),
        doctorId: z.string().optional(),
        roomId: z.string().optional(),
        startsAt: z.string(),
        endsAt: z.string(),
        reason: z.string().trim().max(200).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const organizationId = ctx.session.user.organizationId;

      if (new Date(input.endsAt) <= new Date(input.startsAt)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bitiş saati başlangıçtan sonra olmalıdır." });
      }

      const [doctor, room] = await Promise.all([
        input.doctorId
          ? ctx.db.doctor.findFirst({ where: { id: input.doctorId, organizationId, deletedAt: null } })
          : null,
        input.roomId
          ? ctx.db.room.findFirst({ where: { id: input.roomId, organizationId, branchId: input.branchId, deletedAt: null } })
          : null,
      ]);
      if (input.doctorId && !doctor) throw new TRPCError({ code: "NOT_FOUND", message: "Doktor bulunamadı." });
      if (input.roomId && !room) throw new TRPCError({ code: "NOT_FOUND", message: "Oda bulunamadı." });

      return ctx.db.appointmentBlock.create({
        data: {
          organizationId,
          branchId: input.branchId,
          doctorId: input.doctorId || null,
          roomId: input.roomId || null,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          reason: input.reason || null,
          createdByUserId: ctx.session.user.id,
        },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:appointment:write"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.appointmentBlock.deleteMany({
        where: { id: input.id, ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds) },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
});
