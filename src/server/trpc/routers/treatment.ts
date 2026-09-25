import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, type AccessibleBranches } from "@/server/rbac/scope";
import { logAudit } from "@/server/services/audit";
import type { db as Db } from "@/server/db";

// Ayarlar → "Tedavi onayından önce onam formu zorunlu olsun": when on, a
// treatment can only move to APPROVED if its patient has at least one
// onam formu on record (any template — the clinic picks which applies).
async function assertConsentIfRequired(db: typeof Db, organizationId: string, patientIds: string[]) {
  if (patientIds.length === 0) return;
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { onamRequired: true } });
  if (!org?.onamRequired) return;

  const withConsent = await db.patientConsentForm.findMany({
    where: { organizationId, patientId: { in: patientIds } },
    select: { patientId: true },
    distinct: ["patientId"],
  });
  const covered = new Set(withConsent.map((c) => c.patientId));
  const missing = patientIds.filter((id) => !covered.has(id));
  if (missing.length > 0) {
    const names = await db.patient.findMany({ where: { id: { in: missing } }, select: { fullName: true } });
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Tedavi onayından önce onam formu gerekli: ${names.map((n) => n.fullName).join(", ")}. Hasta kartından onam formu oluşturun.`,
    });
  }
}

/** Valid FDI (ISO 3950) tooth codes: quadrant 1-4 (permanent) has teeth 1-8, quadrant 5-8 (deciduous) has teeth 1-5. */
function isValidFdiTooth(n: number): boolean {
  const quadrant = Math.floor(n / 10);
  const tooth = n % 10;
  if (tooth === 0) return false;
  if (quadrant >= 1 && quadrant <= 4) return tooth >= 1 && tooth <= 8;
  if (quadrant >= 5 && quadrant <= 8) return tooth >= 1 && tooth <= 5;
  return false;
}

const treatmentInput = z.object({
  patientId: z.string(),
  doctorId: z.string(),
  treatmentTypeId: z.string().optional(),
  name: z.string().trim().min(2).max(160),
  toothNumber: z
    .number()
    .int()
    .min(11)
    .max(85)
    .refine(isValidFdiTooth, { message: "Geçersiz diş numarası (FDI notasyonu)." })
    .optional(),
  jaw: z.enum(["UST", "ALT"]).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// Reversible in single steps both ways — Şube Yöneticisi/Doktor/Sekreter can
// walk a treatment forward through PROPOSED -> APPROVED -> COMPLETED, or
// take it back a step (e.g. a treatment marked completed by mistake).
const STATUS_TRANSITIONS: Record<string, string[]> = {
  PROPOSED: ["APPROVED"],
  APPROVED: ["COMPLETED", "PROPOSED"],
  COMPLETED: ["APPROVED"],
};

/**
 * Validates that every patientId/doctorId referenced by a treatment write
 * belongs to the caller's organization (and, for patients, an accessible
 * branch) — without this, a treatment could be created against another
 * tenant's patient/doctor record.
 */
async function assertPatientsAndDoctorsInScope(
  db: typeof import("@/server/db").db,
  organizationId: string,
  accessibleBranchIds: AccessibleBranches,
  patientIds: string[],
  doctorIds: string[],
) {
  const uniquePatientIds = [...new Set(patientIds)];
  const uniqueDoctorIds = [...new Set(doctorIds)];

  const [patients, doctors] = await Promise.all([
    db.patient.findMany({
      where: {
        id: { in: uniquePatientIds },
        deletedAt: null,
        ...branchScopeWhere(organizationId, accessibleBranchIds),
      },
      select: { id: true },
    }),
    db.doctor.findMany({
      where: { id: { in: uniqueDoctorIds }, organizationId, deletedAt: null },
      select: { id: true },
    }),
  ]);

  if (patients.length !== uniquePatientIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı veya erişiminiz yok." });
  }
  if (doctors.length !== uniqueDoctorIds.length) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Doktor bulunamadı veya erişiminiz yok." });
  }
}

/**
 * Ensures toothNumber/jaw presence matches the treatment type's declared
 * scope (DIS_BAZLI vs CENE_BAZLI), and resolves each item's price from the
 * catalog's admin-set defaultPrice — price is never accepted from the
 * client, so a tooth/jaw-based treatment's total is always exactly
 * (unit price) x (however many tooth/jaw rows the caller submits), never a
 * client-supplied number.
 */
async function resolvePricesAndValidateScope(
  db: typeof import("@/server/db").db,
  organizationId: string,
  items: { treatmentTypeId?: string; toothNumber?: number; jaw?: "UST" | "ALT" }[],
): Promise<Map<string, number | null>> {
  const treatmentTypeIds = [...new Set(items.map((i) => i.treatmentTypeId).filter((id): id is string => !!id))];
  const priceById = new Map<string, number | null>();
  if (treatmentTypeIds.length === 0) return priceById;

  const types = await db.treatmentType.findMany({
    where: { id: { in: treatmentTypeIds }, organizationId },
    select: { id: true, scope: true, defaultPrice: true },
  });
  const typeById = new Map(types.map((t) => [t.id, t]));

  for (const item of items) {
    if (!item.treatmentTypeId) continue;
    const type = typeById.get(item.treatmentTypeId);
    if (!type) throw new TRPCError({ code: "NOT_FOUND", message: "Tedavi türü bulunamadı." });
    if (type.scope === "DIS_BAZLI" && item.toothNumber == null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Diş bazlı tedaviler için diş numarası seçilmelidir." });
    }
    if (type.scope === "CENE_BAZLI" && item.jaw == null) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Çene bazlı tedaviler için çene seçilmelidir." });
    }
    priceById.set(type.id, type.defaultPrice);
  }
  return priceById;
}

export const treatmentRouter = router({
  // Backs the dashboard's "Sıradaki Randevu" treatment-picker — approved
  // (not yet completed) treatments for a single patient, so marking a visit
  // ARRIVED can complete the relevant one in the same action.
  listApprovedForPatient: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ patientId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.treatment.findMany({
        where: { patientId: input.patientId, organizationId: ctx.session.user.organizationId, status: "APPROVED" },
        orderBy: { proposedAt: "desc" },
      });
    }),

  // Backs the Muhasebe patient page's "approved treatments -> payment plan"
  // flow: treatments the dentist has approved/completed but that haven't
  // been attached to a payment plan yet, so accounting can turn them into
  // one with a couple of clicks instead of re-typing the amount by hand.
  listUnplanned: protectedProcedure
    .use(requireEntitlement("MUHASEBE"))
    .input(z.object({ patientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.patientId,
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
        select: { id: true },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.treatment.findMany({
        where: {
          patientId: input.patientId,
          organizationId: ctx.session.user.organizationId,
          status: { in: ["APPROVED", "COMPLETED"] },
          paymentPlanId: null,
        },
        include: { doctor: { include: { user: true } } },
        orderBy: { proposedAt: "desc" },
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:treatment:write"))
    .input(treatmentInput)
    .mutation(async ({ ctx, input }) => {
      await assertPatientsAndDoctorsInScope(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.accessibleBranchIds,
        [input.patientId],
        [input.doctorId],
      );
      const priceById = await resolvePricesAndValidateScope(ctx.db, ctx.session.user.organizationId, [input]);

      return ctx.db.treatment.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          patientId: input.patientId,
          doctorId: input.doctorId,
          treatmentTypeId: input.treatmentTypeId || null,
          name: input.name,
          toothNumber: input.toothNumber ?? null,
          jaw: input.jaw ?? null,
          price: input.treatmentTypeId ? (priceById.get(input.treatmentTypeId) ?? null) : null,
          notes: input.notes || null,
        },
      });
    }),

  createBulk: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:treatment:write"))
    .input(z.object({ items: z.array(treatmentInput).min(1).max(64) }))
    .mutation(async ({ ctx, input }) => {
      await assertPatientsAndDoctorsInScope(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.accessibleBranchIds,
        input.items.map((i) => i.patientId),
        input.items.map((i) => i.doctorId),
      );
      const priceById = await resolvePricesAndValidateScope(ctx.db, ctx.session.user.organizationId, input.items);

      const { count } = await ctx.db.treatment.createMany({
        data: input.items.map((item) => ({
          organizationId: ctx.session.user.organizationId,
          patientId: item.patientId,
          doctorId: item.doctorId,
          treatmentTypeId: item.treatmentTypeId || null,
          name: item.name,
          toothNumber: item.toothNumber ?? null,
          jaw: item.jaw ?? null,
          price: item.treatmentTypeId ? (priceById.get(item.treatmentTypeId) ?? null) : null,
          notes: item.notes || null,
        })),
      });
      return { count };
    }),

  // Whole-mouth treatment plans can propose dozens of per-tooth rows at
  // once (see createBulk) — approving them one-by-one isn't realistic, so
  // this lets a doctor select several PROPOSED rows and approve them all in
  // a single, atomic call.
  approveMany: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:treatment:write"))
    .input(z.object({ ids: z.array(z.string()).min(1).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const where = {
        id: { in: input.ids },
        organizationId: ctx.session.user.organizationId,
        status: "PROPOSED" as const,
        patient: {
          deletedAt: null,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
      };
      const targets = await ctx.db.treatment.findMany({ where, select: { patientId: true }, distinct: ["patientId"] });
      await assertConsentIfRequired(ctx.db, ctx.session.user.organizationId, targets.map((t) => t.patientId));

      const { count } = await ctx.db.treatment.updateMany({
        where,
        data: { status: "APPROVED", approvedAt: new Date() },
      });
      return { count };
    }),

  updateStatus: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:treatment:write"))
    .input(z.object({ id: z.string(), status: z.enum(["PROPOSED", "APPROVED", "COMPLETED"]) }))
    .mutation(async ({ ctx, input }) => {
      const treatment = await ctx.db.treatment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.session.user.organizationId,
          patient: {
            deletedAt: null,
            ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          },
        },
      });
      if (!treatment) throw new TRPCError({ code: "NOT_FOUND" });

      const allowed = STATUS_TRANSITIONS[treatment.status] ?? [];
      if (treatment.status !== input.status && !allowed.includes(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Tedavi durumu ${treatment.status} iken ${input.status} durumuna geçilemez.`,
        });
      }
      if (treatment.status === "PROPOSED" && input.status === "APPROVED") {
        await assertConsentIfRequired(ctx.db, ctx.session.user.organizationId, [treatment.patientId]);
      }

      return ctx.db.treatment.update({
        where: { id: input.id },
        data: {
          status: input.status,
          approvedAt: input.status === "APPROVED" ? new Date() : input.status === "PROPOSED" ? null : treatment.approvedAt,
          completedAt: input.status === "COMPLETED" ? new Date() : input.status === "APPROVED" ? null : treatment.completedAt,
        },
      });
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:treatment:write"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const treatment = await ctx.db.treatment.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.session.user.organizationId,
          patient: {
            deletedAt: null,
            ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
          },
        },
      });
      if (!treatment) throw new TRPCError({ code: "NOT_FOUND" });
      if (treatment.status !== "PROPOSED") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Yalnızca önerilen tedaviler silinebilir." });
      }

      await ctx.db.treatment.delete({ where: { id: input.id } });

      await logAudit(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        "treatment.deleted",
        "Treatment",
        input.id,
        { name: treatment.name },
      );

      return { success: true };
    }),
});
