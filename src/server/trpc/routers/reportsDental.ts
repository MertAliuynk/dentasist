import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, branchSelfWhere } from "@/server/rbac/scope";

export const reportsDentalRouter = router({
  summary: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:reports:branch"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const where = {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        startsAt: { gte: new Date(input.start), lte: new Date(input.end) },
      };

      const [appointments, treatments] = await Promise.all([
        ctx.db.appointment.findMany({
          where,
          include: { doctor: { include: { user: true } } },
        }),
        ctx.db.treatment.findMany({
          where: {
            organizationId: ctx.session.user.organizationId,
            proposedAt: { gte: new Date(input.start), lte: new Date(input.end) },
            ...(ctx.accessibleBranchIds === "ALL"
              ? {}
              : { patient: { branchId: { in: ctx.accessibleBranchIds } } }),
          },
        }),
      ]);

      const byDoctor = new Map<string, { doctorId: string; doctorName: string; total: number; completed: number; noShow: number }>();
      for (const appt of appointments) {
        const key = appt.doctorId;
        const entry = byDoctor.get(key) ?? {
          doctorId: key,
          doctorName: appt.doctor.user.name,
          total: 0,
          completed: 0,
          noShow: 0,
        };
        entry.total += 1;
        if (appt.status === "COMPLETED" || appt.status === "ARRIVED") entry.completed += 1;
        if (appt.status === "NO_SHOW") entry.noShow += 1;
        byDoctor.set(key, entry);
      }

      const statusCounts = {
        SCHEDULED: 0,
        ARRIVED: 0,
        NO_SHOW: 0,
        POSTPONED: 0,
        COMPLETED: 0,
        CANCELED: 0,
      };
      for (const appt of appointments) statusCounts[appt.status] += 1;

      const treatmentCounts = { PROPOSED: 0, APPROVED: 0, COMPLETED: 0 };
      for (const t of treatments) treatmentCounts[t.status] += 1;

      return {
        totalAppointments: appointments.length,
        statusCounts,
        treatmentCounts,
        byDoctor: [...byDoctor.values()],
      };
    }),

  // Backs Raporlar > Tedavi İstatistikleri — which treatment types are most
  // proposed/approved/completed, and their total value.
  treatmentTypeBreakdown: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:reports:branch"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const treatments = await ctx.db.treatment.findMany({
        where: {
          organizationId: ctx.session.user.organizationId,
          proposedAt: { gte: new Date(input.start), lte: new Date(input.end) },
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { patient: { branchId: { in: ctx.accessibleBranchIds } } }),
        },
        include: { treatmentType: true },
      });

      const byType = new Map<string, { name: string; count: number; totalValue: number }>();
      for (const t of treatments) {
        const key = t.treatmentType?.name ?? t.name;
        const entry = byType.get(key) ?? { name: key, count: 0, totalValue: 0 };
        entry.count += 1;
        entry.totalValue += t.price ?? 0;
        byType.set(key, entry);
      }

      return [...byType.values()].sort((a, b) => b.count - a.count);
    }),

  // Backs Raporlar > Hasta İstatistikleri.
  patientStats: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:reports:branch"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds);
      const [totalPatients, newPatients, byBranch] = await Promise.all([
        ctx.db.patient.count({ where: { ...scope, deletedAt: null } }),
        ctx.db.patient.count({
          where: { ...scope, deletedAt: null, createdAt: { gte: new Date(input.start), lte: new Date(input.end) } },
        }),
        ctx.db.patient.groupBy({
          by: ["branchId"],
          where: { ...scope, deletedAt: null },
          _count: { _all: true },
        }),
      ]);

      const branches = await ctx.db.branch.findMany({ where: branchSelfWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds), select: { id: true, name: true } });
      const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

      return {
        totalPatients,
        newPatients,
        byBranch: byBranch.map((b) => ({
          branchId: b.branchId,
          branchName: branchNameById.get(b.branchId) ?? "—",
          count: b._count._all,
        })),
      };
    }),
});
