import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const labPatientRouter = router({
  create: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:patient:write"))
    .input(
      z.object({
        fullName: z.string().trim().min(2).max(160),
        note: z.string().trim().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      // A Hekim's Klinik is fixed at account creation (Doctor.klinikId) — every
      // patient they add belongs to that same Klinik, so there's nothing to pick.
      const doctor = await ctx.db.doctor.findUnique({ where: { userId: ctx.session.user.id } });
      if (!doctor || !doctor.klinikId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Bu işlem yalnızca bir kliniğe bağlı Hekim hesapları için geçerlidir." });
      }

      return ctx.db.labPatient.create({
        data: {
          organizationId,
          klinikId: doctor.klinikId,
          doctorId: doctor.id,
          fullName: input.fullName,
          note: input.note || null,
        },
      });
    }),

  getById: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:patient:read"))
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const roles = ctx.session.user.memberships.map((m) => m.role);
      const isBroadRole = roles.includes("PATRON") || roles.includes("SUBE_YONETICISI");

      const patient = await ctx.db.labPatient.findFirst({
        where: {
          id: input.id,
          organizationId: ctx.session.user.organizationId,
          deletedAt: null,
        },
        include: {
          klinik: true,
          doctor: { include: { user: true } },
          treatments: {
            include: {
              labTreatmentType: true,
              toothColor: true,
              stages: { include: { stageCatalog: true, addedByUser: true }, orderBy: { createdAt: "asc" } },
              feedback: { include: { author: true }, orderBy: { createdAt: "asc" } },
            },
            orderBy: { createdAt: "desc" },
          },
        },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });

      if (!isBroadRole) {
        const accessible =
          ctx.accessibleBranchIds === "ALL" ? true : ctx.accessibleBranchIds.includes(patient.klinik.branchId);
        const ownDoctor = await ctx.db.doctor.findUnique({ where: { userId: ctx.session.user.id }, select: { id: true } });
        const isOwnHekim = roles.includes("DOKTOR") && ownDoctor?.id === patient.doctorId;
        const isTeknisyenInBranch = roles.includes("TEKNISYEN") && accessible;
        if (!isOwnHekim && !isTeknisyenInBranch) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
      }

      return patient;
    }),
});
