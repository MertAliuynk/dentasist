import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement } from "@/server/trpc/trpc";
import { branchScopeWhere } from "@/server/rbac/scope";
import { CONSENT_FORM_TEMPLATES } from "@/lib/dental/consent-form-templates";

export const patientConsentFormRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ patientId: z.string() }))
    .query(({ ctx, input }) => {
      return ctx.db.patientConsentForm.findMany({
        where: {
          patientId: input.patientId,
          organizationId: ctx.session.user.organizationId,
          ...(ctx.accessibleBranchIds === "ALL" ? {} : { patient: { branchId: { in: ctx.accessibleBranchIds } } }),
        },
        include: { createdBy: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  // Records that a template was generated/printed for a patient — the
  // template content itself is static (see consent-form-templates.ts), this
  // just backs the dated history shown on the patient page.
  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ patientId: z.string(), templateKey: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const template = CONSENT_FORM_TEMPLATES.find((t) => t.key === input.templateKey);
      if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Geçersiz onam formu şablonu." });

      const patient = await ctx.db.patient.findFirst({
        where: {
          id: input.patientId,
          ...branchScopeWhere(ctx.session.user.organizationId, ctx.accessibleBranchIds),
        },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.patientConsentForm.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          patientId: input.patientId,
          templateKey: template.key,
          templateTitle: template.title,
          createdByUserId: ctx.session.user.id,
        },
      });
    }),
});
