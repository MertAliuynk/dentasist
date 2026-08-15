import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

export const labFeedbackRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("LABORATUVAR"))
    .use(requireCapability("lab:patient:read"))
    .query(({ ctx }) => {
      const roles = ctx.session.user.memberships.map((m) => m.role);
      const organizationId = ctx.session.user.organizationId;

      let where: Record<string, unknown> = { organizationId };
      if (roles.includes("PATRON") || roles.includes("SUBE_YONETICISI")) {
        if (ctx.accessibleBranchIds !== "ALL") {
          where = {
            ...where,
            labTreatment: { labPatient: { klinik: { branchId: { in: ctx.accessibleBranchIds } } } },
          };
        }
      } else if (roles.includes("TEKNISYEN")) {
        where = { ...where, labTreatment: { finishedByUserId: ctx.session.user.id } };
      } else {
        where = { ...where, authorUserId: ctx.session.user.id };
      }

      return ctx.db.labFeedback.findMany({
        where,
        include: {
          labTreatment: { include: { labPatient: true, labTreatmentType: true } },
          author: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),
});
