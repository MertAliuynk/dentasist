import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * What the patient still owes, in kuruş:
 *  - unpaid part of every ACTIVE payment plan, plus
 *  - approved/completed treatments not covered by an active/completed plan,
 *    minus patient payments that never landed on an installment.
 * Used to stop a "Hasta Geliri" larger than the debt.
 */
export async function patientOutstanding(db: Db, organizationId: string, patientId: string) {
  const [plans, unplanned, entries] = await Promise.all([
    db.paymentPlan.findMany({
      where: { organizationId, patientId, status: "ACTIVE" },
      select: { totalAmount: true, installments: { select: { paidAmount: true } } },
    }),
    db.treatment.aggregate({
      where: {
        organizationId,
        patientId,
        status: { in: ["APPROVED", "COMPLETED"] },
        OR: [{ paymentPlanId: null }, { paymentPlan: { status: { in: ["DRAFT", "CANCELED"] } } }],
      },
      _sum: { price: true },
    }),
    db.cashRegisterEntry.findMany({
      where: { organizationId, patientId, type: "GELIR", deletedAt: null },
      select: { amount: true, allocations: { select: { amount: true } } },
    }),
  ]);

  const planned = plans.reduce(
    (s, p) => s + Math.max(0, p.totalAmount - p.installments.reduce((a, i) => a + i.paidAmount, 0)),
    0,
  );
  const unallocated = entries.reduce(
    (s, e) => s + Math.max(0, e.amount - e.allocations.reduce((a, x) => a + x.amount, 0)),
    0,
  );
  const unplannedDebt = Math.max(0, (unplanned._sum.price ?? 0) - unallocated);

  return planned + unplannedDebt;
}
