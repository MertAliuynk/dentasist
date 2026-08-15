import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const labReportsRouter = router({
  branchSummary: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:reports:branch"))
    .query(async ({ ctx }) => {
      const organizationId = ctx.session.user.organizationId;
      const branches = await ctx.db.branch.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { id: { in: ctx.accessibleBranchIds } }),
        },
        orderBy: { name: "asc" },
      });

      return Promise.all(
        branches.map(async (branch) => {
          const [doctorCount, treatments] = await Promise.all([
            ctx.db.doctor.count({ where: { branchId: branch.id, klinikId: { not: null }, deletedAt: null } }),
            ctx.db.labTreatment.findMany({
              where: { organizationId, labPatient: { klinik: { branchId: branch.id } } },
              select: { price: true, status: true },
            }),
          ]);
          const completed = treatments.filter((t) => t.status === "TAMAMLANDI");
          const active = treatments.filter((t) => t.status === "DEVAM_EDIYOR");
          return {
            branchId: branch.id,
            branchName: branch.name,
            doctorCount,
            activeJobCount: active.length,
            completedJobCount: completed.length,
            totalDebt: completed.reduce((s, t) => s + t.price, 0),
          };
        }),
      );
    }),

  doctorDebt: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:cash:read"))
    .input(z.object({ klinikId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const doctors = await ctx.db.doctor.findMany({
        where: {
          organizationId,
          deletedAt: null,
          klinikId: input.klinikId ?? { not: null },
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { branchId: { in: ctx.accessibleBranchIds } }),
        },
        include: { user: true, klinik: true, labTreatments: { select: { price: true, status: true } } },
      });

      return doctors.map((d) => {
        const completed = d.labTreatments.filter((t) => t.status === "TAMAMLANDI");
        const active = d.labTreatments.filter((t) => t.status === "DEVAM_EDIYOR");
        return {
          doctorId: d.id,
          doctorName: d.user.name,
          klinikId: d.klinikId,
          klinikName: d.klinik?.name ?? "",
          totalDebt: completed.reduce((s, t) => s + t.price, 0),
          activeJobCount: active.length,
          completedJobCount: completed.length,
        };
      });
    }),

  klinikDebt: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:cash:read"))
    .query(async ({ ctx }) => {
      const organizationId = ctx.session.user.organizationId;
      const klinikler = await ctx.db.klinik.findMany({
        where: {
          organizationId,
          deletedAt: null,
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { branchId: { in: ctx.accessibleBranchIds } }),
        },
        include: {
          hekimler: { where: { deletedAt: null }, include: { labTreatments: { select: { price: true, status: true } } } },
        },
        orderBy: { name: "asc" },
      });

      return klinikler.map((k) => {
        const allTreatments = k.hekimler.flatMap((h) => h.labTreatments);
        const completed = allTreatments.filter((t) => t.status === "TAMAMLANDI");
        return {
          klinikId: k.id,
          klinikName: k.name,
          doctorCount: k.hekimler.length,
          totalDebt: completed.reduce((s, t) => s + t.price, 0),
        };
      });
    }),

  klinikDetail: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:cash:read"))
    .input(z.object({ klinikId: z.string() }))
    .query(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const klinik = await ctx.db.klinik.findFirst({
        where: {
          id: input.klinikId,
          organizationId,
          deletedAt: null,
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { branchId: { in: ctx.accessibleBranchIds } }),
        },
      });
      if (!klinik) throw new TRPCError({ code: "NOT_FOUND" });

      const doctors = await ctx.db.doctor.findMany({
        where: { klinikId: klinik.id, deletedAt: null },
        include: { user: true, labTreatments: { select: { price: true, status: true } } },
      });

      return {
        klinik,
        doctors: doctors.map((d) => {
          const completed = d.labTreatments.filter((t) => t.status === "TAMAMLANDI");
          const active = d.labTreatments.filter((t) => t.status === "DEVAM_EDIYOR");
          return {
            doctorId: d.id,
            doctorName: d.user.name,
            totalDebt: completed.reduce((s, t) => s + t.price, 0),
            activeJobCount: active.length,
            completedJobCount: completed.length,
          };
        }),
      };
    }),
});
