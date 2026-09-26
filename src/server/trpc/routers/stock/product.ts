import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";
import { receiveStock } from "@/server/stock/stock-service";
import type { db as Db } from "@/server/db";

const DAY = 24 * 60 * 60 * 1000;
export const EXPIRY_WARN_DAYS = 60;

const readProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read"));
const manageProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:manage"));

/**
 * Products plus everything the list/KPIs need: stock value, nearest expiry,
 * expired / soon-expiring quantities and a consumption-based "days left".
 */
export async function productsWithMetrics(db: typeof Db, where: Prisma.StockProductWhereInput) {
  const products = await db.stockProduct.findMany({
    where: { ...where, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true, phone: true, email: true, contactName: true } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });
  if (products.length === 0) return [];
  const ids = products.map((p) => p.id);
  const now = new Date();
  const warnUntil = new Date(now.getTime() + EXPIRY_WARN_DAYS * DAY);

  const [lots, usage, lastMoves] = await Promise.all([
    db.stockLot.findMany({
      where: { productId: { in: ids }, quantity: { gt: 0 } },
      select: { productId: true, quantity: true, unitCost: true, expiryDate: true },
    }),
    db.stockMovement.groupBy({
      by: ["productId"],
      where: { productId: { in: ids }, type: "CIKIS", reason: { in: ["KULLANIM", "HASTA_KULLANIMI"] }, createdAt: { gte: new Date(now.getTime() - 30 * DAY) } },
      _sum: { quantity: true },
    }),
    db.stockMovement.groupBy({ by: ["productId"], where: { productId: { in: ids } }, _max: { createdAt: true } }),
  ]);
  const usageBy = new Map(usage.map((u) => [u.productId, u._sum.quantity ?? 0]));
  const lastBy = new Map(lastMoves.map((m) => [m.productId, m._max.createdAt]));
  const lotsBy = new Map<string, typeof lots>();
  for (const l of lots) lotsBy.set(l.productId, [...(lotsBy.get(l.productId) ?? []), l]);

  return products.map((p) => {
    const pl = lotsBy.get(p.id) ?? [];
    const value = pl.reduce((s, l) => s + l.quantity * (l.unitCost ?? p.unitPrice ?? 0), 0);
    const dated = pl.filter((l) => l.expiryDate).sort((a, b) => +a.expiryDate! - +b.expiryDate!);
    const expiredQty = dated.filter((l) => l.expiryDate! <= now).reduce((s, l) => s + l.quantity, 0);
    const expiringQty = dated.filter((l) => l.expiryDate! > now && l.expiryDate! <= warnUntil).reduce((s, l) => s + l.quantity, 0);
    const used30 = usageBy.get(p.id) ?? 0;
    const status: "OUT" | "LOW" | "OK" = p.quantity === 0 ? "OUT" : p.quantity <= p.criticalLevel ? "LOW" : "OK";
    return {
      ...p,
      value,
      nearestExpiry: dated[0]?.expiryDate ?? null,
      expiredQty,
      expiringQty,
      used30,
      daysLeft: used30 > 0 ? Math.floor(p.quantity / (used30 / 30)) : null,
      lastMovementAt: lastBy.get(p.id) ?? null,
      status,
    };
  });
}

const productFields = {
  name: z.string().trim().min(1, "Ürün adı gerekli.").max(160),
  code: z.string().trim().max(60).optional().nullable(),
  brand: z.string().trim().max(80).optional().nullable(),
  unit: z.string().trim().min(1).max(20).default("adet"),
  categoryId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  criticalLevel: z.number().int().min(0).default(0),
  targetLevel: z.number().int().min(0).optional().nullable(),
  unitPrice: z.number().int().min(0).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
};

async function assertRefs(db: typeof Db, organizationId: string, categoryId?: string | null, supplierId?: string | null) {
  const [category, supplier] = await Promise.all([
    categoryId ? db.stockCategory.findFirst({ where: { id: categoryId, organizationId, deletedAt: null } }) : null,
    supplierId ? db.supplier.findFirst({ where: { id: supplierId, organizationId, deletedAt: null } }) : null,
  ]);
  if (categoryId && !category) throw new TRPCError({ code: "NOT_FOUND", message: "Kategori bulunamadı." });
  if (supplierId && !supplier) throw new TRPCError({ code: "NOT_FOUND", message: "Tedarikçi bulunamadı." });
}

export const stockProductRouter = router({
  list: readProc.query(({ ctx }) =>
    productsWithMetrics(ctx.db, branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds)),
  ),

  // Detail drawer: lots (FEFO order) + recent history.
  get: readProc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const [p] = await productsWithMetrics(ctx.db, {
      id: input.id,
      ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
    });
    if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Ürün bulunamadı." });
    const [lots, movements] = await Promise.all([
      ctx.db.stockLot.findMany({
        where: { productId: p.id, quantity: { gt: 0 } },
        orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
      }),
      ctx.db.stockMovement.findMany({
        where: { productId: p.id },
        include: { patient: { select: { id: true, fullName: true } }, createdBy: { select: { name: true } }, supplier: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return { ...p, lots, movements };
  }),

  create: manageProc
    .input(
      z.object({
        branchId: z.string(),
        ...productFields,
        // Opening stock, optionally as a dated lot.
        initialQuantity: z.number().int().min(0).default(0),
        initialLotNo: z.string().trim().max(60).optional().nullable(),
        initialExpiry: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const organizationId = ctx.session.user.organizationId;
      await assertRefs(ctx.db, organizationId, input.categoryId, input.supplierId);

      return ctx.db.$transaction(async (tx) => {
        const product = await tx.stockProduct.create({
          data: {
            organizationId,
            branchId: input.branchId,
            name: input.name,
            code: input.code || null,
            brand: input.brand || null,
            unit: input.unit,
            categoryId: input.categoryId || null,
            supplierId: input.supplierId || null,
            criticalLevel: input.criticalLevel,
            targetLevel: input.targetLevel ?? null,
            unitPrice: input.unitPrice ?? null,
            note: input.note || null,
          },
        });
        if (input.initialQuantity > 0) {
          await receiveStock(tx, {
            organizationId,
            userId: ctx.session.user.id,
            product,
            quantity: input.initialQuantity,
            reason: "ACILIS",
            unitCost: input.unitPrice ?? null,
            lotNo: input.initialLotNo,
            expiryDate: input.initialExpiry ? new Date(input.initialExpiry) : null,
            note: "Açılış stoğu",
          });
        }
        return product;
      });
    }),

  update: manageProc
    .input(z.object({ id: z.string(), ...productFields }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      await assertRefs(ctx.db, organizationId, input.categoryId, input.supplierId);
      const { id, ...f } = input;
      const { count } = await ctx.db.stockProduct.updateMany({
        where: { id, deletedAt: null, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
        data: {
          name: f.name,
          code: f.code || null,
          brand: f.brand || null,
          unit: f.unit,
          categoryId: f.categoryId || null,
          supplierId: f.supplierId || null,
          criticalLevel: f.criticalLevel,
          targetLevel: f.targetLevel ?? null,
          unitPrice: f.unitPrice ?? null,
          note: f.note || null,
        },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Ürün bulunamadı." });
      return { success: true };
    }),

  delete: manageProc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.stockProduct.updateMany({
      where: { id: input.id, deletedAt: null, ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds) },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Ürün bulunamadı." });
    return { success: true };
  }),
});
