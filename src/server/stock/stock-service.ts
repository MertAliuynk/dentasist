import { TRPCError } from "@trpc/server";
import type { Prisma, StockMovementReason } from "@prisma/client";

// Stock rules in one place: every change goes through receive/consume so
// lots, the product's cached total and the movement log never disagree.

type Tx = Prisma.TransactionClient;

type Base = {
  organizationId: string;
  userId: string;
  product: { id: string; branchId: string; name: string };
};

export async function receiveStock(
  tx: Tx,
  args: Base & {
    quantity: number;
    reason: Extract<StockMovementReason, "SATIN_ALMA" | "ACILIS" | "SAYIM">;
    unitCost?: number | null;
    lotNo?: string | null;
    expiryDate?: Date | null;
    supplierId?: string | null;
    invoiceNo?: string | null;
    note?: string | null;
  },
) {
  await tx.stockLot.create({
    data: {
      organizationId: args.organizationId,
      productId: args.product.id,
      lotNo: args.lotNo || null,
      expiryDate: args.expiryDate ?? null,
      quantity: args.quantity,
      initialQuantity: args.quantity,
      unitCost: args.unitCost ?? null,
    },
  });
  await tx.stockProduct.update({
    where: { id: args.product.id },
    data: {
      quantity: { increment: args.quantity },
      // Latest purchase price becomes the product's reference price.
      ...(args.reason === "SATIN_ALMA" && args.unitCost != null ? { unitPrice: args.unitCost } : {}),
      ...(args.reason === "SATIN_ALMA" && args.supplierId ? { supplierId: args.supplierId } : {}),
    },
  });
  return tx.stockMovement.create({
    data: {
      organizationId: args.organizationId,
      productId: args.product.id,
      branchId: args.product.branchId,
      type: "GIRIS",
      reason: args.reason,
      quantity: args.quantity,
      unitCost: args.unitCost ?? null,
      supplierId: args.supplierId || null,
      invoiceNo: args.invoiceNo || null,
      lotNo: args.lotNo || null,
      expiryDate: args.expiryDate ?? null,
      note: args.note || null,
      createdByUserId: args.userId,
    },
  });
}

/**
 * Takes `quantity` out, FEFO across lots (earliest expiry first, undated
 * lots last), or only from `lotId` when given (e.g. disposing an expired
 * batch). Guarded updates make concurrent consumption safe: if another
 * request took the stock first, this one fails instead of going negative.
 */
export async function consumeStock(
  tx: Tx,
  args: Base & {
    quantity: number;
    reason: Extract<StockMovementReason, "KULLANIM" | "HASTA_KULLANIMI" | "FIRE" | "SKT_IMHA" | "IADE" | "SAYIM">;
    lotId?: string | null;
    patientId?: string | null;
    supplierId?: string | null;
    note?: string | null;
  },
) {
  const lots = await tx.stockLot.findMany({
    where: { productId: args.product.id, quantity: { gt: 0 }, ...(args.lotId ? { id: args.lotId } : {}) },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
  });
  const available = lots.reduce((s, l) => s + l.quantity, 0);
  if (available < args.quantity) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: args.lotId
        ? `Seçilen partide yalnızca ${available} adet var.`
        : `Yetersiz stok: "${args.product.name}" için eldeki miktar ${available}.`,
    });
  }

  let left = args.quantity;
  const breakdown: { lotId: string; lotNo: string | null; expiryDate: string | null; quantity: number }[] = [];
  for (const lot of lots) {
    if (left === 0) break;
    const take = Math.min(lot.quantity, left);
    const { count } = await tx.stockLot.updateMany({
      where: { id: lot.id, quantity: { gte: take } },
      data: { quantity: { decrement: take } },
    });
    if (count === 0) {
      throw new TRPCError({ code: "CONFLICT", message: "Stok bu sırada başka bir işlemle değişti. Lütfen tekrar deneyin." });
    }
    breakdown.push({ lotId: lot.id, lotNo: lot.lotNo, expiryDate: lot.expiryDate?.toISOString() ?? null, quantity: take });
    left -= take;
  }

  const { count } = await tx.stockProduct.updateMany({
    where: { id: args.product.id, quantity: { gte: args.quantity } },
    data: { quantity: { decrement: args.quantity } },
  });
  if (count === 0) {
    throw new TRPCError({ code: "CONFLICT", message: "Stok bu sırada başka bir işlemle değişti. Lütfen tekrar deneyin." });
  }

  return tx.stockMovement.create({
    data: {
      organizationId: args.organizationId,
      productId: args.product.id,
      branchId: args.product.branchId,
      type: "CIKIS",
      reason: args.reason,
      quantity: args.quantity,
      patientId: args.patientId || null,
      supplierId: args.supplierId || null,
      lotBreakdown: breakdown,
      lotNo: breakdown.length === 1 ? breakdown[0].lotNo : null,
      note: args.note || null,
      createdByUserId: args.userId,
    },
  });
}
