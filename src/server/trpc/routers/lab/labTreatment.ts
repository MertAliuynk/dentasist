import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { GlobalRole } from "@prisma/client";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { logAudit } from "@/server/services/audit";
import { notifyTeknisyenInBranch, notifyUser } from "@/server/trpc/routers/lab/_notify";
import type { db as Db } from "@/server/db";

function getOwnDoctor(db: typeof Db, userId: string) {
  return db.doctor.findUnique({ where: { userId } });
}

function isBroadRole(roles: GlobalRole[]) {
  return roles.includes("PATRON") || roles.includes("SUBE_YONETICISI");
}

export const labTreatmentRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:patient:read"))
    .input(z.object({ status: z.enum(["DEVAM_EDIYOR", "TAMAMLANDI"]).optional() }))
    .query(async ({ ctx, input }) => {
      const roles = ctx.session.user.memberships.map((m) => m.role);
      const organizationId = ctx.session.user.organizationId;
      const branchFilter = (branchIds: string[]) => ({ labPatient: { klinik: { branchId: { in: branchIds } } } });

      let where: Record<string, unknown> = { organizationId };
      if (isBroadRole(roles)) {
        if (ctx.accessibleBranchIds !== "ALL") where = { ...where, ...branchFilter(ctx.accessibleBranchIds) };
      } else if (roles.includes("TEKNISYEN")) {
        where = { ...where, ...branchFilter(ctx.accessibleBranchIds === "ALL" ? [] : ctx.accessibleBranchIds) };
      } else {
        const doctor = await getOwnDoctor(ctx.db, ctx.session.user.id);
        where = { ...where, doctorId: doctor?.id ?? "__none__" };
      }
      if (input.status) where = { ...where, status: input.status };

      return ctx.db.labTreatment.findMany({
        where,
        include: {
          labPatient: { include: { klinik: true } },
          doctor: { include: { user: true } },
          labTreatmentType: true,
          toothColor: true,
          stages: { orderBy: { createdAt: "desc" }, take: 1, include: { stageCatalog: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  myStats: protectedProcedure.use(requireEntitlement("LABORATUVAR")).use(requireCapability("lab:patient:read")).query(async ({ ctx }) => {
    const doctor = await getOwnDoctor(ctx.db, ctx.session.user.id);
    if (!doctor) return { totalDebt: 0, patientCount: 0, activeJobCount: 0, completedJobCount: 0 };

    const [completed, active, patientCount] = await Promise.all([
      ctx.db.labTreatment.findMany({ where: { doctorId: doctor.id, status: "TAMAMLANDI" }, select: { price: true } }),
      ctx.db.labTreatment.count({ where: { doctorId: doctor.id, status: "DEVAM_EDIYOR" } }),
      ctx.db.labPatient.count({ where: { doctorId: doctor.id, deletedAt: null } }),
    ]);

    return {
      totalDebt: completed.reduce((sum, t) => sum + t.price, 0),
      patientCount,
      activeJobCount: active,
      completedJobCount: completed.length,
    };
  }),

  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:patient:write"))
    .input(
      z.object({
        labPatientId: z.string(),
        labTreatmentTypeId: z.string(),
        toothColorId: z.string().optional(),
        price: z.number().int().min(0).optional(),
        firstStage: z.object({
          stageCatalogId: z.string(),
          dueDate: z.string(),
          note: z.string().trim().max(2000).optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const doctor = await getOwnDoctor(ctx.db, ctx.session.user.id);
      if (!doctor) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem yalnızca Hekim hesapları için geçerlidir." });
      }

      const patient = await ctx.db.labPatient.findFirst({
        where: { id: input.labPatientId, organizationId, doctorId: doctor.id, deletedAt: null },
        include: { klinik: true },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });

      const treatmentType = await ctx.db.labTreatmentType.findFirst({
        where: { id: input.labTreatmentTypeId, organizationId, deletedAt: null },
      });
      if (!treatmentType) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz protez/tedavi türü." });

      if (input.toothColorId) {
        const color = await ctx.db.toothColor.findFirst({
          where: { id: input.toothColorId, organizationId, deletedAt: null },
        });
        if (!color) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz diş rengi." });
      }

      const stageCatalog = await ctx.db.labStageCatalog.findFirst({
        where: { id: input.firstStage.stageCatalogId, organizationId, deletedAt: null },
      });
      if (!stageCatalog) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz aşama." });

      const treatment = await ctx.db.$transaction(async (tx) => {
        const created = await tx.labTreatment.create({
          data: {
            organizationId,
            labPatientId: patient.id,
            labTreatmentTypeId: treatmentType.id,
            doctorId: doctor.id,
            toothColorId: input.toothColorId || null,
            price: input.price ?? treatmentType.price,
          },
        });
        await tx.labTreatmentStage.create({
          data: {
            labTreatmentId: created.id,
            stageCatalogId: stageCatalog.id,
            addedByUserId: ctx.session.user.id,
            dueDate: new Date(input.firstStage.dueDate),
            note: input.firstStage.note || null,
          },
        });
        return created;
      });

      await notifyTeknisyenInBranch(
        ctx.db,
        organizationId,
        patient.klinik.branchId,
        treatment.id,
        `${patient.fullName} için yeni bir iş eklendi (${treatmentType.name}).`,
      );

      return treatment;
    }),

  addStage: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:stage:write"))
    .input(
      z.object({
        labTreatmentId: z.string(),
        stageCatalogId: z.string(),
        dueDate: z.string(),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const treatment = await ctx.db.labTreatment.findFirst({
        where: { id: input.labTreatmentId, organizationId },
        include: { labPatient: { include: { klinik: true } }, doctor: true },
      });
      if (!treatment) throw new TRPCError({ code: "NOT_FOUND" });
      if (treatment.status !== "DEVAM_EDIYOR") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tamamlanmış bir tedaviye aşama eklenemez." });
      }

      const roles = ctx.session.user.memberships.map((m) => m.role);
      const ownDoctor = roles.includes("DOKTOR") ? await getOwnDoctor(ctx.db, ctx.session.user.id) : null;
      const isOwnHekim = !!ownDoctor && ownDoctor.id === treatment.doctorId;
      const branchId = treatment.labPatient.klinik.branchId;
      const isTeknisyenInBranch =
        roles.includes("TEKNISYEN") &&
        (ctx.accessibleBranchIds === "ALL" || ctx.accessibleBranchIds.includes(branchId));
      const isPatron = roles.includes("PATRON");
      if (!isOwnHekim && !isTeknisyenInBranch && !isPatron) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const stageCatalog = await ctx.db.labStageCatalog.findFirst({
        where: { id: input.stageCatalogId, organizationId, deletedAt: null },
      });
      if (!stageCatalog) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz aşama." });

      const stage = await ctx.db.labTreatmentStage.create({
        data: {
          labTreatmentId: treatment.id,
          stageCatalogId: stageCatalog.id,
          addedByUserId: ctx.session.user.id,
          dueDate: new Date(input.dueDate),
          note: input.note || null,
        },
      });

      const isTeknisyenAction = roles.includes("TEKNISYEN") && !isOwnHekim;
      if (isTeknisyenAction) {
        await notifyUser(
          ctx.db,
          organizationId,
          treatment.doctor.userId,
          treatment.id,
          `${stageCatalog.name} aşaması eklendi.`,
        );
      } else {
        await notifyTeknisyenInBranch(
          ctx.db,
          organizationId,
          branchId,
          treatment.id,
          `${stageCatalog.name} aşaması eklendi.`,
        );
      }

      return stage;
    }),

  finish: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:stage:finish"))
    .input(z.object({ labTreatmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const treatment = await ctx.db.labTreatment.findFirst({
        where: { id: input.labTreatmentId, organizationId },
        include: { labPatient: { include: { klinik: true } }, doctor: true },
      });
      if (!treatment) throw new TRPCError({ code: "NOT_FOUND" });
      if (treatment.status !== "DEVAM_EDIYOR") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Tedavi zaten tamamlanmış." });
      }

      const roles = ctx.session.user.memberships.map((m) => m.role);
      const branchId = treatment.labPatient.klinik.branchId;
      const isTeknisyenInBranch =
        roles.includes("TEKNISYEN") &&
        (ctx.accessibleBranchIds === "ALL" || ctx.accessibleBranchIds.includes(branchId));
      if (!isTeknisyenInBranch && !roles.includes("PATRON")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const updated = await ctx.db.labTreatment.update({
        where: { id: treatment.id },
        data: { status: "TAMAMLANDI", completedAt: new Date(), finishedByUserId: ctx.session.user.id },
      });

      await notifyUser(
        ctx.db,
        organizationId,
        treatment.doctor.userId,
        treatment.id,
        "Tedaviniz tamamlandı (bitim yapıldı).",
      );

      await logAudit(ctx.db, organizationId, ctx.session.user.id, "lab.treatment_finished", "LabTreatment", treatment.id);

      return updated;
    }),

  addFeedback: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:feedback:write"))
    .input(z.object({ labTreatmentId: z.string(), message: z.string().trim().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const treatment = await ctx.db.labTreatment.findFirst({
        where: { id: input.labTreatmentId, organizationId },
        include: { labPatient: { include: { klinik: true } } },
      });
      if (!treatment) throw new TRPCError({ code: "NOT_FOUND" });
      if (treatment.status !== "TAMAMLANDI") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Yalnızca tamamlanmış tedavilere geri bildirim verilebilir." });
      }

      const doctor = await getOwnDoctor(ctx.db, ctx.session.user.id);
      if (!doctor || doctor.id !== treatment.doctorId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Yalnızca tedavinin sahibi hekim geri bildirim verebilir." });
      }

      const feedback = await ctx.db.labFeedback.create({
        data: {
          organizationId,
          labTreatmentId: treatment.id,
          authorUserId: ctx.session.user.id,
          message: input.message,
        },
      });

      if (treatment.finishedByUserId) {
        await notifyUser(ctx.db, organizationId, treatment.finishedByUserId, treatment.id, "Tedaviniz için geri bildirim aldınız.");
      } else {
        await notifyTeknisyenInBranch(
          ctx.db,
          organizationId,
          treatment.labPatient.klinik.branchId,
          treatment.id,
          "Tamamlanan bir tedavi için geri bildirim aldınız.",
        );
      }

      return feedback;
    }),
});
