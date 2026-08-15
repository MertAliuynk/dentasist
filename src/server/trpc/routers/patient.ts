import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, assertAccessibleBranch } from "@/server/rbac/scope";
import { logAudit } from "@/server/services/audit";

export const tcKimlikSchema = z
  .string()
  .trim()
  .regex(/^\d{11}$/, "TC kimlik numarası 11 haneli olmalıdır.")
  .refine((value) => {
    const digits = value.split("").map(Number);
    if (digits[0] === 0) return false;
    const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
    const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
    const digit10 = (oddSum * 7 - evenSum) % 10;
    const digit11 = (oddSum + evenSum + digits[9]) % 10;
    return digit10 === digits[9] && digit11 === digits[10];
  }, "Geçersiz TC kimlik numarası.")
  .optional()
  .or(z.literal(""));

export const patientRouter = router({
  // Doctors see every patient in their own branch (not just their own
  // primary-doctor patients) — branchScopeWhere already limits a DOKTOR
  // membership to just their branch, so no extra doctorId filter is needed
  // here; a doctor asking to see "their" patients specifically is served by
  // filtering client-side or via primaryDoctorId as an explicit query param
  // if ever needed, not as an implicit server-side restriction.
  list: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(
      z.object({
        search: z.string().trim().max(120).optional(),
        branchId: z.string().optional(),
        doctorId: z.string().optional(),
        sortBy: z.enum(["name", "createdAt", "birthDate"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(25),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        deletedAt: null,
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.doctorId ? { primaryDoctorId: input.doctorId } : {}),
        ...(input.search
          ? {
              OR: [
                { fullName: { contains: input.search, mode: "insensitive" as const } },
                { phone: { contains: input.search } },
                { tcKimlikNo: { contains: input.search } },
              ],
            }
          : {}),
      };

      const orderBy =
        input.sortBy === "name"
          ? { fullName: input.sortDir }
          : input.sortBy === "birthDate"
            ? { birthDate: input.sortDir }
            : { createdAt: input.sortDir };

      const patients = await ctx.db.patient.findMany({
        where,
        include: { primaryDoctor: { include: { user: true } } },
        orderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (patients.length > input.limit) {
        const next = patients.pop();
        nextCursor = next!.id;
      }

      return { patients, nextCursor };
    }),

  getById: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        include: {
          primaryDoctor: { include: { user: true } },
          treatments: {
            include: { doctor: { include: { user: true } }, treatmentType: true },
            orderBy: { proposedAt: "desc" },
          },
          notes: { include: { author: true }, orderBy: { createdAt: "desc" } },
          appointments: {
            include: { doctor: { include: { user: true } }, completedTreatment: true },
            orderBy: { startsAt: "desc" },
          },
          companions: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });
      return patient;
    }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(160),
        phone: z.string().trim().min(7).max(20),
        branchId: z.string().min(1),
        primaryDoctorId: z.string().optional(),
        tcKimlikNo: tcKimlikSchema,
        birthDate: z.string().optional(),
        anamnesis: z.string().trim().max(4000).optional(),
        anamnesisAnswers: z.record(z.string(), z.any()).optional(),
        companions: z
          .array(z.object({ fullName: z.string().trim().min(2).max(160), phone: z.string().trim().max(30).optional() }))
          .max(5)
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const patient = await ctx.db.patient.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          branchId: input.branchId,
          fullName: input.fullName,
          phone: input.phone,
          primaryDoctorId: input.primaryDoctorId || null,
          tcKimlikNo: input.tcKimlikNo || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          anamnesis: input.anamnesis || null,
          anamnesisAnswers:
            input.anamnesisAnswers && Object.keys(input.anamnesisAnswers).length > 0 ? input.anamnesisAnswers : undefined,
          companions: input.companions?.length
            ? { create: input.companions.map((c) => ({ fullName: c.fullName, phone: c.phone || null })) }
            : undefined,
        },
      });

      await logAudit(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        "patient.created",
        "Patient",
        patient.id,
        { fullName: patient.fullName },
      );

      return patient;
    }),

  addCompanion: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(z.object({ patientId: z.string(), fullName: z.string().trim().min(2).max(160), phone: z.string().trim().max(30).optional() }))
    .mutation(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.patientId,
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        select: { id: true },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.patientCompanion.create({
        data: { patientId: input.patientId, fullName: input.fullName, phone: input.phone || null },
      });
    }),

  deleteCompanion: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const companion = await ctx.db.patientCompanion.findFirst({
        where: {
          id: input.id,
          patient: { deletedAt: null, ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds) },
        },
      });
      if (!companion) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.patientCompanion.delete({ where: { id: companion.id } });
      return { success: true };
    }),

  bulkCreate: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(
      z.object({
        branchId: z.string().min(1),
        patients: z
          .array(
            z.object({
              fullName: z.string().trim().min(2).max(160),
              phone: z.string().trim().min(7).max(20),
              tcKimlikNo: tcKimlikSchema,
            }),
          )
          .min(1)
          .max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      assertAccessibleBranch(ctx.accessibleBranchIds, input.branchId);
      const result = await ctx.db.patient.createMany({
        data: input.patients.map((p) => ({
          organizationId: ctx.session.user.organizationId,
          branchId: input.branchId,
          fullName: p.fullName,
          phone: p.phone,
          tcKimlikNo: p.tcKimlikNo || null,
        })),
      });
      return { count: result.count };
    }),

  update: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(
      z.object({
        id: z.string(),
        fullName: z.string().trim().min(2).max(160),
        phone: z.string().trim().min(7).max(20),
        primaryDoctorId: z.string().optional().nullable(),
        tcKimlikNo: tcKimlikSchema,
        birthDate: z.string().optional().nullable(),
        anamnesis: z.string().trim().max(4000).optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.patient.updateMany({
        where: {
          id: input.id,
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        data: {
          fullName: input.fullName,
          phone: input.phone,
          primaryDoctorId: input.primaryDoctorId || null,
          tcKimlikNo: input.tcKimlikNo || null,
          birthDate: input.birthDate ? new Date(input.birthDate) : null,
          anamnesis: input.anamnesis || null,
        },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:patient:write"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.patient.updateMany({
        where: {
          id: input.id,
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        data: { deletedAt: new Date() },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });

      await logAudit(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        "patient.deleted",
        "Patient",
        input.id,
      );

      return { success: true };
    }),

  listForMuhasebe: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .input(
      z.object({
        search: z.string().trim().max(120).optional(),
        branchId: z.string().optional(),
        doctorId: z.string().optional(),
        status: z.enum(["TAMAMLANDI", "BEKLIYOR", "GECIKMIS"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const patients = await ctx.db.patient.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          deletedAt: null,
          ...(input.branchId ? { branchId: input.branchId } : {}),
          ...(input.doctorId ? { primaryDoctorId: input.doctorId } : {}),
          ...(input.search
            ? {
                OR: [
                  { fullName: { contains: input.search, mode: "insensitive" as const } },
                  { phone: { contains: input.search } },
                ],
              }
            : {}),
        },
        include: {
          primaryDoctor: { include: { user: true } },
          paymentPlans: {
            where: { status: "ACTIVE" },
            include: { installments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const now = new Date();
      const rows = patients.map((p) => {
        const installments = p.paymentPlans.flatMap((plan) => plan.installments);
        const unpaid = installments.filter((i) => i.status !== "PAID");
        const paid = installments.filter((i) => i.status === "PAID");
        // paidAmount already reflects partial payments correctly (it's the
        // running sum of allocated cash entries), so summing it across every
        // installment — not just the fully-PAID ones — gives the true
        // received amount even when a lump sum only partly covered one.
        const remaining = installments.reduce((sum, i) => sum + (i.amount - i.paidAmount), 0);
        const paidAmount = installments.reduce((sum, i) => sum + i.paidAmount, 0);
        const totalAmount = p.paymentPlans.reduce((sum, plan) => sum + plan.totalAmount, 0);
        const lastPayment = paid
          .map((i) => i.paidAt)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        const nextPayment = unpaid
          .map((i) => i.dueDate)
          .sort((a, b) => a.getTime() - b.getTime())[0];
        const isOverdue = unpaid.some((i) => i.dueDate < now);
        const status: "TAMAMLANDI" | "BEKLIYOR" | "GECIKMIS" =
          totalAmount > 0 && remaining === 0 ? "TAMAMLANDI" : isOverdue ? "GECIKMIS" : "BEKLIYOR";

        return {
          id: p.id,
          fullName: p.fullName,
          phone: p.phone,
          branchId: p.branchId,
          doctorId: p.primaryDoctorId,
          doctorName: p.primaryDoctor?.user.name ?? null,
          totalAmount,
          paidAmount,
          remaining,
          lastPaymentDate: lastPayment ?? null,
          nextPaymentDate: nextPayment ?? null,
          status,
        };
      });

      return input.status ? rows.filter((r) => r.status === input.status) : rows;
    }),

  // Backs Ayarlar > Veri İndir — a full (capped) CSV-ready export of the
  // org's own patient records, for the accessible branches only.
  exportCsv: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("org:user:manage"))
    .query(({ ctx }) => {
      return ctx.db.patient.findMany({
        where: {
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          deletedAt: null,
        },
        include: { branch: true, primaryDoctor: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
        take: 5000,
      });
    }),

  getFinanceSummary: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.id,
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });

      const plans = await ctx.db.paymentPlan.findMany({
        where: { patientId: input.id, organizationId: ctx.session.user.organizationId },
        include: { installments: { orderBy: { sequence: "asc" } } },
        orderBy: { createdAt: "desc" },
      });

      const activeInstallments = plans
        .filter((p) => p.status === "ACTIVE")
        .flatMap((p) => p.installments);
      const totalAmount = plans.filter((p) => p.status === "ACTIVE").reduce((s, p) => s + p.totalAmount, 0);
      const received = activeInstallments.reduce((s, i) => s + i.paidAmount, 0);
      const remaining = totalAmount - received;

      return { patient, plans, totalAmount, received, remaining };
    }),
});
