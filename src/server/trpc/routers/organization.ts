import { z } from "zod";
import { router, protectedProcedure, requirePatron } from "@/server/trpc/trpc";
import { logAudit } from "@/server/services/audit";

export const organizationRouter = router({
  get: protectedProcedure.query(({ ctx }) => {
    return ctx.db.organization.findUniqueOrThrow({
      where: { id: ctx.session.user.organizationId },
      include: {
        subscription: {
          include: { plan: true, entitlements: true, discountCode: true },
        },
      },
    });
  }),

  updateSettings: protectedProcedure
    .use(requirePatron())
    .input(
      z.object({
        name: z.string().trim().min(2).max(120).optional(),
        phone: z.string().trim().max(30).optional(),
        address: z.string().trim().max(500).optional(),
        taxNumber: z.string().trim().max(30).optional(),
        taxOffice: z.string().trim().max(120).optional(),
        billingEmail: z.string().trim().email().optional().or(z.literal("")),
        billingAddress: z.string().trim().max(500).optional(),
        workingHours: z
          .record(
            z.string(),
            z.object({ open: z.string(), close: z.string(), closed: z.boolean() }),
          )
          .optional(),
        appointmentDurationMinutes: z.number().int().min(5).max(480).optional(),
        appointmentBufferMinutes: z.number().int().min(0).max(120).optional(),
        smsRemindersEnabled: z.boolean().optional(),
        anamnezRequired: z.boolean().optional(),
        onamRequired: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.organization.update({
        where: { id: ctx.session.user.organizationId },
        data: {
          ...input,
          billingEmail: input.billingEmail === "" ? null : input.billingEmail,
        },
      });

      await logAudit(
        ctx.db,
        ctx.session.user.organizationId,
        ctx.session.user.id,
        "organization.settings_updated",
        "Organization",
        updated.id,
        { fields: Object.keys(input) },
      );

      return updated;
    }),
});
