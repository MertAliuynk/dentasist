import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";
import { stockCategoryRouter } from "@/server/trpc/routers/stock/category";
import { supplierRouter } from "@/server/trpc/routers/stock/supplier";
import { productsWithMetrics, stockProductRouter } from "@/server/trpc/routers/stock/product";
import { stockMovementRouter } from "@/server/trpc/routers/stock/movement";

const DAY = 24 * 60 * 60 * 1000;
const readProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read"));

export const stockRouter = router({
  category: stockCategoryRouter,
  supplier: supplierRouter,
  product: stockProductRouter,
  movement: stockMovementRouter,

  // KPI tiles + "Raporlar" tab.
  summary: readProc.input(z.object({ days: z.number().int().min(7).max(365).default(30) })).query(async ({ ctx, input }) => {
    const scope = branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds);
    const since = new Date(Date.now() - input.days * DAY);
    const [products, moves] = await Promise.all([
      productsWithMetrics(ctx.db, scope),
      ctx.db.stockMovement.findMany({
        where: { ...scope, createdAt: { gte: since } },
        select: { productId: true, type: true, reason: true, quantity: true, unitCost: true, product: { select: { unitPrice: true } } },
      }),
    ]);

    const priceOf = (m: (typeof moves)[number]) => m.unitCost ?? m.product.unitPrice ?? 0;
    const purchases = moves.filter((m) => m.type === "GIRIS" && m.reason === "SATIN_ALMA").reduce((s, m) => s + m.quantity * priceOf(m), 0);
    const usedValue = moves
      .filter((m) => m.type === "CIKIS" && (m.reason === "KULLANIM" || m.reason === "HASTA_KULLANIMI"))
      .reduce((s, m) => s + m.quantity * priceOf(m), 0);
    const lossValue = moves
      .filter((m) => m.type === "CIKIS" && (m.reason === "FIRE" || m.reason === "SKT_IMHA"))
      .reduce((s, m) => s + m.quantity * priceOf(m), 0);

    const byProduct = new Map<string, { qty: number; value: number }>();
    for (const m of moves) {
      if (m.type !== "CIKIS" || (m.reason !== "KULLANIM" && m.reason !== "HASTA_KULLANIMI")) continue;
      const cur = byProduct.get(m.productId) ?? { qty: 0, value: 0 };
      byProduct.set(m.productId, { qty: cur.qty + m.quantity, value: cur.value + m.quantity * priceOf(m) });
    }
    const nameOf = new Map(products.map((p) => [p.id, p]));
    const topUsed = [...byProduct.entries()]
      .map(([id, v]) => ({ id, name: nameOf.get(id)?.name ?? "—", unit: nameOf.get(id)?.unit ?? "", ...v }))
      .sort((a, b) => b.value - a.value || b.qty - a.qty)
      .slice(0, 10);

    return {
      productCount: products.length,
      totalValue: products.reduce((s, p) => s + p.value, 0),
      lowCount: products.filter((p) => p.status === "LOW").length,
      outCount: products.filter((p) => p.status === "OUT").length,
      expiringCount: products.filter((p) => p.expiringQty > 0).length,
      expiredCount: products.filter((p) => p.expiredQty > 0).length,
      purchases,
      usedValue,
      lossValue,
      topUsed,
    };
  }),

  // "Sipariş Listesi": everything at/below critical, grouped by supplier,
  // with how many to order to get back to the target level.
  reorder: readProc.query(async ({ ctx }) => {
    const products = await productsWithMetrics(ctx.db, branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds));
    const need = products
      .filter((p) => p.status !== "OK")
      .map((p) => {
        const target = p.targetLevel && p.targetLevel > p.criticalLevel ? p.targetLevel : Math.max(p.criticalLevel * 2, p.criticalLevel + 1);
        return { ...p, suggested: Math.max(target - p.quantity, 1), estimatedCost: Math.max(target - p.quantity, 1) * (p.unitPrice ?? 0) };
      });
    const groups = new Map<string, { supplier: (typeof need)[number]["supplier"]; items: typeof need }>();
    for (const p of need) {
      const key = p.supplier?.id ?? "none";
      const g = groups.get(key) ?? { supplier: p.supplier, items: [] };
      g.items.push(p);
      groups.set(key, g);
    }
    return [...groups.values()].sort((a, b) => (a.supplier ? 0 : 1) - (b.supplier ? 0 : 1));
  }),
});
