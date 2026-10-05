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

  updateCommission: protectedProcedure
    .use(requireCapability("org:user:manage"))
    .input(z.object({ id: z.string(), commissionRate: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.doctor.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId, deletedAt: null },
        data: { commissionRate: input.commissionRate },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Hekim bulunamadı." });
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

  // Doctors the caller may book appointments for: a doctor-only account
  // gets just themselves (matches the server-side rule in appointment.create).
  bookable: protectedProcedure.query(async ({ ctx }) => {
    const roles = new Set(ctx.session.user.memberships.map((m) => m.role));
    const doctorOnly = roles.size === 1 && roles.has("DOKTOR");
    return ctx.db.doctor.findMany({
      where: {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
        ...(doctorOnly ? { userId: ctx.session.user.id } : {}),
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
            include: { patient: { select: { fullName: true } } },
            orderBy: { completedAt: "desc" },
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
      // Two common ways clinics pay doctors; the page lets the user pick:
      //  - tahsilat: (collected from the doctor's patients − doctor expenses) × rate
      //  - tedavi:   price of treatments completed in the range × rate
      const collectionBase = Math.max(0, totalIncome - totalExpense);
      const earningsByCollection = Math.round((collectionBase * commissionRate) / 100);
      const earningsByTreatment = Math.round((treatmentRevenue * commissionRate) / 100);
      const pendingAmount = pendingInstallments.reduce((s, i) => s + (i.amount - i.paidAmount), 0);

      return {
        doctor,
        commissionRate,
        totalIncome,
        totalExpense,
        collectionBase,
        treatmentRevenue,
        earningsByCollection,
        earningsByTreatment,
        pendingAmount,
        incomeEntries,
        expenseEntries,
        completedTreatments: completedTreatments.map((t) => ({
          id: t.id,
          name: t.name,
          toothNumber: t.toothNumber,
          price: t.price ?? 0,
          completedAt: t.completedAt,
          patientName: t.patient.fullName,
        })),
      };
    }),
});
