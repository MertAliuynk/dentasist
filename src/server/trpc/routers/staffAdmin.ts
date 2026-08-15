import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requirePatron } from "@/server/trpc/trpc";
import { ALL_CAPABILITIES } from "@/server/rbac/permissions";
import { logAudit } from "@/server/services/audit";

const capabilityEnum = z.enum(ALL_CAPABILITIES);
const effectEnum = z.enum(["GRANT", "REVOKE"]);

export const staffAdminRouter = router({
  /** Cross-branch operational snapshot — every branch in the org, regardless of the caller's own membership scope (Patron sees everything here by definition). */
  branchOverview: protectedProcedure.use(requirePatron()).query(async ({ ctx }) => {
    const organizationId = ctx.session.user.organizationId;
    const branches = await ctx.db.branch.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: "asc" },
    });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    return Promise.all(
      branches.map(async (branch) => {
        const [doctorCount, staffCount, patientCount, todayAppointments, monthIncome, monthExpense] =
          await Promise.all([
            ctx.db.doctor.count({ where: { branchId: branch.id, deletedAt: null } }),
            ctx.db.membership.count({ where: { branchId: branch.id } }),
            ctx.db.patient.count({ where: { branchId: branch.id, deletedAt: null } }),
            ctx.db.appointment.count({
              where: { branchId: branch.id, startsAt: { gte: startOfToday, lte: endOfToday } },
            }),
            ctx.db.cashRegisterEntry.aggregate({
              where: { branchId: branch.id, type: "GELIR", entryDate: { gte: startOfMonth } },
              _sum: { amount: true },
            }),
            ctx.db.cashRegisterEntry.aggregate({
              where: { branchId: branch.id, type: "GIDER", entryDate: { gte: startOfMonth } },
              _sum: { amount: true },
            }),
          ]);

        return {
          branchId: branch.id,
          branchName: branch.name,
          doctorCount,
          staffCount,
          patientCount,
          todayAppointments,
          monthIncome: monthIncome._sum.amount ?? 0,
          monthExpense: monthExpense._sum.amount ?? 0,
        };
      }),
    );
  }),

  listStaff: protectedProcedure.use(requirePatron()).query(({ ctx }) => {
    return ctx.db.user.findMany({
      where: { organizationId: ctx.session.user.organizationId, deletedAt: null },
      include: {
        memberships: { include: { branch: true } },
        doctorProfile: true,
        capabilityOverrides: { select: { capability: true, effect: true } },
      },
      orderBy: { name: "asc" },
    });
  }),

  updateOverrides: protectedProcedure
    .use(requirePatron())
    .input(
      z.object({
        userId: z.string(),
        overrides: z
          .array(z.object({ capability: capabilityEnum, effect: effectEnum }))
          .max(ALL_CAPABILITIES.length),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const target = await ctx.db.user.findFirst({
        where: { id: input.userId, organizationId, deletedAt: null },
        include: { memberships: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.memberships.some((m) => m.role === "PATRON")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Patron rolündeki kullanıcıların yetkileri değiştirilemez.",
        });
      }

      const deduped = new Map(input.overrides.map((o) => [o.capability, o.effect]));

      await ctx.db.$transaction([
        ctx.db.userCapabilityOverride.deleteMany({ where: { userId: target.id } }),
        ...(deduped.size > 0
          ? [
              ctx.db.userCapabilityOverride.createMany({
                data: [...deduped.entries()].map(([capability, effect]) => ({
                  organizationId,
                  userId: target.id,
                  capability,
                  effect,
                  createdByUserId: ctx.session.user.id,
                })),
              }),
            ]
          : []),
      ]);

      await logAudit(
        ctx.db,
        organizationId,
        ctx.session.user.id,
        "staff.permissions_updated",
        "User",
        target.id,
        { overrides: [...deduped.entries()].map(([capability, effect]) => ({ capability, effect })) },
      );

      return { success: true };
    }),

  setStaffActive: protectedProcedure
    .use(requirePatron())
    .input(z.object({ userId: z.string(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      if (input.userId === ctx.session.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Kendi hesabınızı devre dışı bırakamazsınız." });
      }
      const target = await ctx.db.user.findFirst({
        where: { id: input.userId, organizationId },
        include: { memberships: true },
      });
      if (!target) throw new TRPCError({ code: "NOT_FOUND" });
      if (target.memberships.some((m) => m.role === "PATRON")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Patron rolündeki bir hesap devre dışı bırakılamaz." });
      }

      await ctx.db.user.update({
        where: { id: target.id },
        data: { deletedAt: input.active ? null : new Date() },
      });

      await logAudit(
        ctx.db,
        organizationId,
        ctx.session.user.id,
        input.active ? "staff.reactivated" : "staff.deactivated",
        "User",
        target.id,
      );

      return { success: true };
    }),
});
