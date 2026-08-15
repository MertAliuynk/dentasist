import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma, PaymentMethod } from "@prisma/client";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";
import { logAudit } from "@/server/services/audit";

function dayRange(dateStr: string) {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

type Tx = Prisma.TransactionClient;

/**
 * A "Hasta Geliri" entry (type=GELIR, patientId set) automatically applies
 * its amount across the patient's unpaid/partially-paid installments (across
 * active plans), earliest due date first — cascading across as many
 * installments as the amount covers, and partially filling the last one if
 * it doesn't cover it in full. Each installment touched gets an
 * InstallmentAllocation row recording exactly how much of this entry went to
 * it, so a later deletion can reverse precisely that amount rather than
 * all-or-nothing.
 */
async function autoApplyToInstallments(
  tx: Tx,
  organizationId: string,
  patientId: string,
  amount: number,
  method: PaymentMethod,
  cashRegisterEntryId: string,
) {
  const activePlans = await tx.paymentPlan.findMany({
    where: { organizationId, patientId, status: "ACTIVE" },
    include: {
      installments: { where: { status: { not: "PAID" } }, orderBy: { sequence: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  const candidates = activePlans
    .flatMap((plan) => plan.installments)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  let remaining = amount;
  const now = new Date();

  for (const installment of candidates) {
    if (remaining <= 0) break;
    const owed = installment.amount - installment.paidAmount;
    if (owed <= 0) continue;

    const applied = Math.min(remaining, owed);
    const newPaidAmount = installment.paidAmount + applied;
    const newStatus = newPaidAmount >= installment.amount ? "PAID" : "PARTIAL";

    await tx.installment.update({
      where: { id: installment.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        ...(newStatus === "PAID" ? { paidAt: now, paidMethod: method } : {}),
      },
    });
    await tx.installmentAllocation.create({
      data: {
        organizationId,
        installmentId: installment.id,
        cashRegisterEntryId,
        amount: applied,
      },
    });

    remaining -= applied;
  }
}

/** Reverses every allocation this cash entry made, restoring each touched
 * installment's paidAmount/status to what it would be without this payment. */
async function reverseAllocations(tx: Tx, cashRegisterEntryId: string) {
  const allocations = await tx.installmentAllocation.findMany({
    where: { cashRegisterEntryId },
    include: { installment: true },
  });

  for (const alloc of allocations) {
    const installment = alloc.installment;
    const newPaidAmount = Math.max(0, installment.paidAmount - alloc.amount);
    const newStatus = newPaidAmount <= 0 ? "UNPAID" : newPaidAmount >= installment.amount ? "PAID" : "PARTIAL";

    await tx.installment.update({
      where: { id: installment.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        ...(newStatus !== "PAID" ? { paidAt: null, paidMethod: null } : {}),
      },
    });
  }

  await tx.installmentAllocation.deleteMany({ where: { cashRegisterEntryId } });
}

export const cashRegisterRouter = router({
  listByDate: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const { start, end } = dayRange(input.date);
      const entries = await ctx.db.cashRegisterEntry.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          entryDate: { gte: start, lte: end },
          deletedAt: null,
        },
        include: { category: true, patient: true, doctor: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
      });

      const income = entries.filter((e) => e.type === "GELIR");
      const expense = entries.filter((e) => e.type === "GIDER");

      const byMethod = { NAKIT: 0, HAVALE: 0, KREDI_KARTI: 0 };
      for (const e of entries) {
        const signed = e.type === "GELIR" ? e.amount : -e.amount;
        byMethod[e.method] += signed;
      }

      return { income, expense, byMethod };
    }),

  create: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:cash:write"))
    .input(
      z.object({
        branchId: z.string(),
        type: z.enum(["GELIR", "GIDER"]),
        method: z.enum(["NAKIT", "HAVALE", "KREDI_KARTI"]),
        amount: z.number().int().min(1),
        categoryId: z.string().optional(),
        doctorId: z.string().optional(),
        patientId: z.string().optional(),
        description: z.string().trim().max(300).optional(),
        entryDate: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);

      // Server-side enforcement of the Hasta Geliri/Klinik Geliri and Hekim
      // Gideri/Klinik Gideri split — the client UI only offers a doctor
      // picker for GIDER and a patient picker for GELIR, but that's just a
      // dropdown; without this the mutation itself would happily accept a
      // GELIR entry with a doctorId or a GIDER entry with a patientId.
      if (input.type === "GELIR" && input.doctorId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gelir kayıtlarında hekim seçilemez.",
        });
      }
      if (input.type === "GIDER" && input.patientId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gider kayıtlarında hasta seçilemez.",
        });
      }
      if (input.type === "GIDER" && !input.categoryId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Gider eklerken bir gider kalemi seçilmelidir.",
        });
      }

      const organizationId = ctx.session.user.organizationId;
      const [category, doctor, patient] = await Promise.all([
        input.categoryId
          ? ctx.db.expenseCategory.findFirst({ where: { id: input.categoryId, organizationId, deletedAt: null } })
          : null,
        input.doctorId
          ? ctx.db.doctor.findFirst({ where: { id: input.doctorId, organizationId, deletedAt: null } })
          : null,
        input.patientId
          ? ctx.db.patient.findFirst({
              where: { id: input.patientId, deletedAt: null, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
            })
          : null,
      ]);
      if (input.categoryId && !category) throw new TRPCError({ code: "NOT_FOUND", message: "Gider kalemi bulunamadı." });
      if (input.doctorId && !doctor) throw new TRPCError({ code: "NOT_FOUND", message: "Doktor bulunamadı." });
      if (input.patientId && !patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });

      return ctx.db.$transaction(async (tx) => {
        const entry = await tx.cashRegisterEntry.create({
          data: {
            organizationId,
            branchId: input.branchId,
            type: input.type,
            method: input.method,
            amount: input.amount,
            categoryId: input.categoryId || null,
            doctorId: input.doctorId || null,
            patientId: input.patientId || null,
            description: input.description || null,
            entryDate: new Date(input.entryDate),
            createdByUserId: ctx.session.user.id,
          },
        });

        if (input.type === "GELIR" && input.patientId) {
          await autoApplyToInstallments(tx, organizationId, input.patientId, input.amount, input.method, entry.id);
        }

        return entry;
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:cash:delete"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const entry = await ctx.db.cashRegisterEntry.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          ...branchScopeWhere(organizationId, ctx.accessibleBranchIds),
        },
      });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.$transaction(async (tx) => {
        await tx.cashRegisterEntry.update({ where: { id: entry.id }, data: { deletedAt: new Date() } });
        await reverseAllocations(tx, entry.id);
      });

      await logAudit(ctx.db, organizationId, ctx.session.user.id, "cash_entry.deleted", "CashRegisterEntry", entry.id, {
        type: entry.type,
        amount: entry.amount,
      });

      return { success: true };
    }),
});
