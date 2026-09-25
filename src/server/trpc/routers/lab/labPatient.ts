import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import type { db as Db } from "@/server/db";
import type { GlobalRole } from "@prisma/client";

function isBroadRole(roles: GlobalRole[]) {
  return roles.includes("PATRON") || roles.includes("SUBE_YONETICISI");
}

async function resolveLabPatientWhere(
  db: typeof Db,
  organizationId: string,
  userId: string,
  roles: GlobalRole[],
  accessibleBranchIds: string[] | "ALL",
) {
  if (isBroadRole(roles)) {
    if (accessibleBranchIds === "ALL") return { organizationId };
    return { organizationId, klinik: { branchId: { in: accessibleBranchIds } } };
  }
  if (roles.includes("TEKNISYEN")) {
    const branchIds = accessibleBranchIds === "ALL" ? [] : accessibleBranchIds;
    return { organizationId, klinik: { branchId: { in: branchIds } } };
  }
  const doctor = await db.doctor.findUnique({ where: { userId }, select: { id: true } });
  return { organizationId, doctorId: doctor?.id ?? "__none__" };
}

export const labPatientRouter = router({
  // Backs the header "Hasta Ara" search for the Laboratuvar module.
  list: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:patient:read"))
    .input(z.object({ search: z.string().trim().max(120).optional(), limit: z.number().int().min(1).max(50).default(8) }))
    .query(async ({ ctx, input }) => {
      const roles = ctx.session.user.memberships.map((m) => m.role);
      const where = await resolveLabPatientWhere(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        roles,
        ctx.accessibleBranchIds,
      );
      return ctx.db.labPatient.findMany({
        where: {
          ...where,
          deletedAt: null,
          ...(input.search ? { fullName: { contains: input.search, mode: "insensitive" as const } } : {}),
        },
        include: { klinik: true },
        orderBy: { fullName: "asc" },
        take: input.limit,
      });
    }),

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
