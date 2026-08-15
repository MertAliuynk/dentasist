import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import {
  generateEvenSplit,
  recomputeOnCountChange,
  applyManualAmountEdit,
  applyInterest,
  assertBalanced,
  InstallmentEngineError,
  type InstallmentDraft,
} from "@/server/services/installmentEngine";
import { logAudit } from "@/server/services/audit";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";

function toDrafts(installments: { sequence: number; amount: number; dueDate: Date; isLocked: boolean }[]): InstallmentDraft[] {
  return installments.map((i) => ({
    sequence: i.sequence,
    amount: i.amount,
    dueDate: i.dueDate,
    isLocked: i.isLocked,
  }));
}

async function replaceInstallments(
  db: typeof import("@/server/db").db,
  planId: string,
  drafts: InstallmentDraft[],
) {
  await db.$transaction([
    db.installment.deleteMany({ where: { paymentPlanId: planId } }),
    db.installment.createMany({
      data: drafts.map((d) => ({
        paymentPlanId: planId,
        sequence: d.sequence,
        amount: d.amount,
        dueDate: d.dueDate,
        isLocked: d.isLocked,
      })),
    }),
  ]);
}

export const paymentPlanRouter = router({
  listForPatient: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .input(z.object({ patientId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.paymentPlan.findMany({
        where: {
          patientId: input.patientId,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        include: { installments: { orderBy: { sequence: "asc" } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:paymentplan:write"))
    .input(
      z.object({
        patientId: z.string(),
        branchId: z.string(),
        totalAmount: z.number().int().min(1),
        installmentCount: z.number().int().min(1).max(60),
        interestRate: z.number().min(0).max(100).default(0),
        startDate: z.string(),
        notes: z.string().trim().max(2000).optional(),
        treatmentIds: z.array(z.string()).max(200).optional(),
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

      // The interest rate is applied once, up front, to get the real amount
      // owed — otherwise "Faiz Oranı" is stored but never actually charged.
      const totalWithInterest = applyInterest(input.totalAmount, input.interestRate);
      const drafts = generateEvenSplit(totalWithInterest, input.installmentCount, new Date(input.startDate));

      return ctx.db.$transaction(async (tx) => {
        const plan = await tx.paymentPlan.create({
          data: {
            organizationId: ctx.session.user.organizationId,
            branchId: input.branchId,
            patientId: input.patientId,
            totalAmount: totalWithInterest,
            installmentCount: input.installmentCount,
            interestRate: input.interestRate,
            startDate: new Date(input.startDate),
            notes: input.notes || null,
            createdByUserId: ctx.session.user.id,
          },
        });
        await tx.installment.createMany({
          data: drafts.map((d) => ({
            paymentPlanId: plan.id,
            sequence: d.sequence,
            amount: d.amount,
            dueDate: d.dueDate,
            isLocked: d.isLocked,
          })),
        });

        if (input.treatmentIds?.length) {
          await tx.treatment.updateMany({
            where: {
              id: { in: input.treatmentIds },
              patientId: input.patientId,
              organizationId: ctx.session.user.organizationId,
              paymentPlanId: null,
            },
            data: { paymentPlanId: plan.id },
          });
        }

        return plan;
      });
    }),

  updateInstallmentCount: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:paymentplan:write"))
    .input(z.object({ planId: z.string(), newCount: z.number().int().min(1).max(60) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.paymentPlan.findFirst({
        where: { id: input.planId, ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds) },
        include: { installments: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sadece taslak planların taksit sayısı değiştirilebilir." });
      }

      try {
        const recomputed = recomputeOnCountChange(
          toDrafts(plan.installments),
          input.newCount,
          plan.totalAmount,
          plan.startDate,
        );
        await ctx.db.paymentPlan.update({
          where: { id: plan.id },
          data: { installmentCount: input.newCount },
        });
        await replaceInstallments(ctx.db, plan.id, recomputed);
        return { success: true };
      } catch (error) {
        if (error instanceof InstallmentEngineError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),

  editInstallmentAmount: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:paymentplan:write"))
    .input(z.object({ planId: z.string(), sequence: z.number().int().min(1), amount: z.number().int().min(0) }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.paymentPlan.findFirst({
        where: { id: input.planId, ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds) },
        include: { installments: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Sadece taslak planlarda taksit tutarı düzenlenebilir." });
      }

      try {
        const updated = applyManualAmountEdit(
          toDrafts(plan.installments),
          input.sequence,
          input.amount,
          plan.totalAmount,
        );
        await replaceInstallments(ctx.db, plan.id, updated);
        await logAudit(
          ctx.db,
          ctx.session.user.organizationId,
          ctx.session.user.id,
          "installment.amount_edited",
          "PaymentPlan",
          plan.id,
          { sequence: input.sequence, amount: input.amount },
        );
        return { success: true };
      } catch (error) {
        if (error instanceof InstallmentEngineError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }
    }),

  editInstallmentDueDate: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:paymentplan:write"))
    .input(z.object({ installmentId: z.string(), dueDate: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.db.installment.findFirst({
        where: {
          id: input.installmentId,
          paymentPlan: branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        include: { paymentPlan: true },
      });
      if (!installment) throw new TRPCError({ code: "NOT_FOUND" });
      if (installment.status === "PAID") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Ödenmiş bir taksitin tarihi değiştirilemez." });
      }
      if (installment.paymentPlan.status === "CANCELED" || installment.paymentPlan.status === "COMPLETED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Bu planın taksit tarihleri artık düzenlenemez." });
      }

      return ctx.db.installment.update({
        where: { id: installment.id },
        data: { dueDate: new Date(input.dueDate) },
      });
    }),

  activate: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:paymentplan:activate"))
    .input(z.object({ planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.paymentPlan.findFirst({
        where: { id: input.planId, ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds) },
        include: { installments: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND" });
      if (plan.status !== "DRAFT") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Plan zaten işleme alınmış." });
      }

      try {
        assertBalanced(toDrafts(plan.installments), plan.totalAmount);
      } catch (error) {
        if (error instanceof InstallmentEngineError) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
        }
        throw error;
      }

      const activated = await ctx.db.paymentPlan.update({
        where: { id: plan.id },
        data: { status: "ACTIVE", activatedAt: new Date(), activatedByUserId: ctx.session.user.id },
      });

      await logAudit(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        "payment_plan.activated",
        "PaymentPlan",
        plan.id,
        { totalAmount: plan.totalAmount, installmentCount: plan.installmentCount },
      );

      return activated;
    }),
});
