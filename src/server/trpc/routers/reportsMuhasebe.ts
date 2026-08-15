import { z } from "zod";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";

export const reportsMuhasebeRouter = router({
  summary: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:reports:branch"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const scope = branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds);
      const now = new Date();

      const [installments, entries] = await Promise.all([
        ctx.db.installment.findMany({
          where: { status: { not: "PAID" }, paymentPlan: { ...scope, status: "ACTIVE" } },
        }),
        ctx.db.cashRegisterEntry.findMany({
          where: { ...scope, entryDate: { gte: new Date(input.start), lte: new Date(input.end) }, deletedAt: null },
        }),
      ]);

      const pendingTotal = installments
        .filter((i) => i.dueDate >= now)
        .reduce((s, i) => s + i.amount, 0);
      const overdueTotal = installments
        .filter((i) => i.dueDate < now)
        .reduce((s, i) => s + i.amount, 0);

      const byDay = new Map<string, { date: string; income: number; expense: number }>();
      for (const e of entries) {
        const key = e.entryDate.toISOString().slice(0, 10);
        const day = byDay.get(key) ?? { date: key, income: 0, expense: 0 };
        if (e.type === "GELIR") day.income += e.amount;
        else day.expense += e.amount;
        byDay.set(key, day);
      }

      return {
        pendingTotal,
        overdueTotal,
        dailyBreakdown: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
    }),

  crossBranch: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:reports:org"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.cashRegisterEntry.findMany({
        where: {
          organizationId: ctx.session.user.organizationId,
          entryDate: { gte: new Date(input.start), lte: new Date(input.end) },
          deletedAt: null,
        },
        include: { branch: true },
      });

      const byBranch = new Map<string, { branchId: string; branchName: string; income: number; expense: number }>();
      for (const e of entries) {
        const entry = byBranch.get(e.branchId) ?? {
          branchId: e.branchId,
          branchName: e.branch.name,
          income: 0,
          expense: 0,
        };
        if (e.type === "GELIR") entry.income += e.amount;
        else entry.expense += e.amount;
        byBranch.set(e.branchId, entry);
      }

      return [...byBranch.values()];
    }),

  // Backs the redesigned İncele page: a filterable, paginated, CSV-exportable
  // transaction ledger with org-wide summary + payment-method + branch
  // breakdowns, all computed over the *full* filtered set (not just the
  // current page).
  transactions: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:reports:org"))
    .input(
      z.object({
        start: z.string(),
        end: z.string(),
        type: z.enum(["GELIR", "GIDER"]).optional(),
        branchId: z.string().optional(),
        method: z.enum(["NAKIT", "HAVALE", "KREDI_KARTI"]).optional(),
        sort: z.enum(["asc", "desc"]).default("desc"),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(1).max(200).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const where = {
        organizationId,
        deletedAt: null,
        entryDate: { gte: new Date(input.start), lte: new Date(input.end) },
        ...(ctx.accessibleBranchIds === "ALL" ? {} : { branchId: { in: ctx.accessibleBranchIds } }),
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.type ? { type: input.type } : {}),
        ...(input.method ? { method: input.method } : {}),
      };

      const [rows, total, allMatching] = await Promise.all([
        ctx.db.cashRegisterEntry.findMany({
          where,
          include: { branch: true, patient: true, doctor: { include: { user: true } }, category: true },
          orderBy: { entryDate: input.sort },
          skip: input.page * input.pageSize,
          take: input.pageSize,
        }),
        ctx.db.cashRegisterEntry.count({ where }),
        ctx.db.cashRegisterEntry.findMany({ where, select: { type: true, method: true, amount: true } }),
      ]);

      const totals = {
        income: allMatching.filter((e) => e.type === "GELIR").reduce((s, e) => s + e.amount, 0),
        expense: allMatching.filter((e) => e.type === "GIDER").reduce((s, e) => s + e.amount, 0),
        byMethod: {
          NAKIT: { income: 0, expense: 0 },
          HAVALE: { income: 0, expense: 0 },
          KREDI_KARTI: { income: 0, expense: 0 },
        },
      };
      for (const e of allMatching) {
        if (e.type === "GELIR") totals.byMethod[e.method].income += e.amount;
        else totals.byMethod[e.method].expense += e.amount;
      }

      return { rows, total, totals };
    }),

  // Backs Raporlar > Hekim Borç Raporu — every doctor's outstanding
  // (unpaid/partially-paid) installment balance across their own patients.
  doctorDebtSummary: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:reports:org"))
    .query(async ({ ctx }) => {
      const doctors = await ctx.db.doctor.findMany({
        where: { ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds), deletedAt: null },
        include: { user: true },
      });

      const installments = await ctx.db.installment.findMany({
        where: {
          status: { not: "PAID" },
          paymentPlan: {
            organizationId: ctx.session.user.organizationId,
            patient: { primaryDoctorId: { in: doctors.map((d) => d.id) } },
          },
        },
        include: { paymentPlan: { include: { patient: true } } },
      });

      const debtByDoctor = new Map<string, number>();
      for (const i of installments) {
        const doctorId = i.paymentPlan.patient.primaryDoctorId;
        if (!doctorId) continue;
        debtByDoctor.set(doctorId, (debtByDoctor.get(doctorId) ?? 0) + (i.amount - i.paidAmount));
      }

      return doctors
        .map((d) => ({ doctorId: d.id, doctorName: d.user.name, debt: debtByDoctor.get(d.id) ?? 0 }))
        .sort((a, b) => b.debt - a.debt);
    }),

  // Backs Raporlar > Gider Analizi — spend broken down by gider kalemi.
  expenseBreakdown: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:reports:org"))
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ ctx, input }) => {
      const entries = await ctx.db.cashRegisterEntry.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          type: "GIDER",
          deletedAt: null,
          entryDate: { gte: new Date(input.start), lte: new Date(input.end) },
        },
        include: { category: true },
      });

      const byCategory = new Map<string, { name: string; total: number }>();
      for (const e of entries) {
        const key = e.category?.name ?? "Diğer";
        const entry = byCategory.get(key) ?? { name: key, total: 0 };
        entry.total += e.amount;
        byCategory.set(key, entry);
      }

      return [...byCategory.values()].sort((a, b) => b.total - a.total);
    }),

  // Same filters as `transactions` but returns every matching row (capped)
  // for CSV export, bypassing pagination.
  transactionsExport: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .use(requireCapability("muhasebe:reports:org"))
    .input(
      z.object({
        start: z.string(),
        end: z.string(),
        type: z.enum(["GELIR", "GIDER"]).optional(),
        branchId: z.string().optional(),
        method: z.enum(["NAKIT", "HAVALE", "KREDI_KARTI"]).optional(),
        sort: z.enum(["asc", "desc"]).default("desc"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      return ctx.db.cashRegisterEntry.findMany({
        where: {
          organizationId,
          deletedAt: null,
          entryDate: { gte: new Date(input.start), lte: new Date(input.end) },
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { branchId: { in: ctx.accessibleBranchIds } }),
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.type ? { type: input.type } : {}),
          ...(input.method ? { method: input.method } : {}),
        },
        include: { branch: true, patient: true, doctor: { include: { user: true } }, category: true },
        orderBy: { entryDate: input.sort },
        take: 5000,
      });
    }),
});
