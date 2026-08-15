import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";

export const doctorRouter = router({
  updateColor: protectedProcedure
    .use(requireCapability("org:user:manage"))
    .input(z.object({ id: z.string(), colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.doctor.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { colorHex: input.colorHex },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  list: protectedProcedure.query(({ ctx }) => {
    return ctx.db.doctor.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
      },
      include: { user: true, branch: true },
      orderBy: { user: { name: "asc" } },
    });
  }),

  byId: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    return ctx.db.doctor.findFirst({
      where: {
        id: input.id,
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
      },
      include: { user: true, branch: true },
    });
  }),

  getFinancials: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .input(z.object({ doctorId: z.string(), start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const doctor = await ctx.db.doctor.findFirst({
        where: {
          id: input.doctorId,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        include: { user: true },
      });
      if (!doctor) return null;

      const range = { gte: new Date(input.start), lte: new Date(input.end) };

      const [doctorIncomeEntries, patientIncomeEntries, expenseEntries, completedTreatments, pendingInstallments] =
        await Promise.all([
          ctx.db.cashRegisterEntry.findMany({
            where: {
              ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
              doctorId: doctor.id,
              type: "GELIR",
              entryDate: range,
              deletedAt: null,
            },
            include: { patient: true },
          }),
          // A doctor's income also includes "Hasta Geliri" entries recorded
          // against their own patients (not just entries directly tagged
          // with this doctorId) — otherwise most of a doctor's real income
          // never shows up here at all.
          ctx.db.cashRegisterEntry.findMany({
            where: {
              ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
              patient: { primaryDoctorId: doctor.id },
              type: "GELIR",
              entryDate: range,
              deletedAt: null,
            },
            include: { patient: true },
          }),
          ctx.db.cashRegisterEntry.findMany({
            where: {
              ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
              doctorId: doctor.id,
              type: "GIDER",
              entryDate: range,
              deletedAt: null,
            },
          }),
          ctx.db.treatment.findMany({
            where: {
              organizationId: ctx.session.user.organizationId,
              doctorId: doctor.id,
              status: "COMPLETED",
              completedAt: range,
            },
          }),
          ctx.db.installment.findMany({
            where: {
              status: { not: "PAID" },
              paymentPlan: {
                organizationId: ctx.session.user.organizationId,
                patient: { primaryDoctorId: doctor.id },
              },
            },
          }),
        ]);

      const incomeEntries = [
        ...doctorIncomeEntries,
        ...patientIncomeEntries.filter((e) => !doctorIncomeEntries.some((d) => d.id === e.id)),
      ];

      const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
      const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0);
      const treatmentRevenue = completedTreatments.reduce((s, t) => s + (t.price ?? 0), 0);
      const commissionRate = Number(doctor.commissionRate);
      const earnings = Math.round((treatmentRevenue * commissionRate) / 100);
      const pendingAmount = pendingInstallments.reduce((s, i) => s + (i.amount - i.paidAmount), 0);

      return {
        doctor,
        totalIncome,
        totalExpense,
        earnings,
        pendingAmount,
        incomeEntries,
        expenseEntries,
      };
    }),
});
