import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";
import { consumeStock, receiveStock } from "@/server/stock/stock-service";
import type { db as Db } from "@/server/db";
import type { AccessibleBranches } from "@/server/rbac/scope";

const readProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:read"));
const writeProc = protectedProcedure.use(requireEntitlement("DENTAL")).use(requireCapability("dental:stock:write"));

const REASONS = ["SATIN_ALMA", "ACILIS", "KULLANIM", "HASTA_KULLANIMI", "SAYIM", "FIRE", "SKT_IMHA", "IADE"] as const;

async function loadProduct(db: typeof Db, organizationId: string, accessible: AccessibleBranches, productId: string) {
  const product = await db.stockProduct.findFirst({
    where: { id: productId, deletedAt: null, ...branchScopeWhere(organizationId, accessible) },
    select: { id: true, branchId: true, name: true, quantity: true },
  });
  if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "Ürün bulunamadı." });
  return product;
}

export const stockMovementRouter = router({
  list: readProc
    .input(
      z.object({
        productId: z.string().optional(),
        type: z.enum(["GIRIS", "CIKIS"]).optional(),
        reason: z.enum(REASONS).optional(),
        onlyPatientUsage: z.boolean().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        search: z.string().trim().max(120).optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.StockMovementWhereInput = {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        ...(input.productId ? { productId: input.productId } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
        ...(input.onlyPatientUsage ? { patientId: { not: null } } : {}),
        ...(input.from || input.to
          ? { createdAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) } }
          : {}),
        ...(input.search
          ? {
              OR: [
                { product: { name: { contains: input.search, mode: "insensitive" } } },
                { product: { code: { contains: input.search, mode: "insensitive" } } },
                { patient: { fullName: { contains: input.search, mode: "insensitive" } } },
                { invoiceNo: { contains: input.search, mode: "insensitive" } },
                { lotNo: { contains: input.search, mode: "insensitive" } },
                { note: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : {}),
      };
      const rows = await ctx.db.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, unit: true, code: true, unitPrice: true } },
          branch: { select: { name: true } },
          patient: { select: { id: true, fullName: true } },
          supplier: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      let nextCursor: string | undefined;
      if (rows.length > input.limit) nextCursor = rows.pop()!.id;
      return { rows, nextCursor };
    }),

  // Stok girişi — a delivery becomes a new lot.
  receive: writeProc
    .input(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1, "Miktar en az 1 olmalı."),
        unitCost: z.number().int().min(0).optional().nullable(),
        // Döviz ile alış; unitCost then holds the TL equivalent.
        foreignCost: z
          .object({
            currency: z.enum(["USD", "EUR", "GBP"]),
            unitCost: z.number().int().min(0),
            rate: z.number().positive().max(100000),
          })
          .optional()
          .nullable(),
        lotNo: z.string().trim().max(60).optional().nullable(),
        expiryDate: z.string().optional().nullable(),
        supplierId: z.string().optional().nullable(),
        invoiceNo: z.string().trim().max(60).optional().nullable(),
        note: z.string().trim().max(300).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const product = await loadProduct(ctx.db, organizationId, ctx.accessibleBranchIds, input.productId);
      if (input.supplierId) {
        const s = await ctx.db.supplier.findFirst({ where: { id: input.supplierId, organizationId, deletedAt: null } });
        if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Tedarikçi bulunamadı." });
      }
      return ctx.db.$transaction((tx) =>
        receiveStock(tx, {
          organizationId,
          userId: ctx.session.user.id,
          product,
          quantity: input.quantity,
          reason: "SATIN_ALMA",
          unitCost: input.unitCost,
          foreignCost: input.foreignCost,
          lotNo: input.lotNo,
          expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
          supplierId: input.supplierId,
          invoiceNo: input.invoiceNo,
          note: input.note,
        }),
      );
    }),

  // Stok çıkışı — use, patient use, waste, expired disposal, return.
  consume: writeProc
    .input(
      z.object({
        productId: z.string(),
        quantity: z.number().int().min(1, "Miktar en az 1 olmalı."),
        reason: z.enum(["KULLANIM", "HASTA_KULLANIMI", "FIRE", "SKT_IMHA", "IADE"]),
        lotId: z.string().optional().nullable(),
        patientId: z.string().optional().nullable(),
        note: z.string().trim().max(300).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const product = await loadProduct(ctx.db, organizationId, ctx.accessibleBranchIds, input.productId);
      if (input.reason === "HASTA_KULLANIMI" && !input.patientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Hasta kullanımı için hasta seçin." });
      }
      if (input.patientId) {
        const patient = await ctx.db.patient.findFirst({
          where: { id: input.patientId, deletedAt: null, ...branchScopeWhere(organizationId, ctx.accessibleBranchIds) },
          select: { id: true },
        });
        if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });
      }
      if (input.lotId) {
        const lot = await ctx.db.stockLot.findFirst({ where: { id: input.lotId, productId: product.id } });
        if (!lot) throw new TRPCError({ code: "NOT_FOUND", message: "Parti bulunamadı." });
      }
      const supplier =
        input.reason === "IADE"
          ? await ctx.db.stockProduct.findUnique({ where: { id: product.id }, select: { supplierId: true } })
          : null;
      return ctx.db.$transaction((tx) =>
        consumeStock(tx, {
          organizationId,
          userId: ctx.session.user.id,
          product,
          quantity: input.quantity,
          reason: input.reason,
          lotId: input.lotId,
          patientId: input.reason === "HASTA_KULLANIMI" ? input.patientId : null,
          supplierId: supplier?.supplierId ?? null,
          note: input.note,
        }),
      );
    }),

  // Stok sayımı — set the real counted quantity; the difference is booked.
  count: writeProc
    .input(z.object({ productId: z.string(), countedQuantity: z.number().int().min(0), note: z.string().trim().max(300).optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const product = await loadProduct(ctx.db, organizationId, ctx.accessibleBranchIds, input.productId);
      const diff = input.countedQuantity - product.quantity;
      if (diff === 0) return { diff: 0 };
      const note = input.note || `Sayım: sistem ${product.quantity}, sayılan ${input.countedQuantity}`;
      await ctx.db.$transaction((tx) =>
        diff > 0
          ? receiveStock(tx, { organizationId, userId: ctx.session.user.id, product, quantity: diff, reason: "SAYIM", note })
          : consumeStock(tx, { organizationId, userId: ctx.session.user.id, product, quantity: -diff, reason: "SAYIM", note }),
      );
      return { diff };
    }),
});
