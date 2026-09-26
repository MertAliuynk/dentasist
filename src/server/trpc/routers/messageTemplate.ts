import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";

const channelSchema = z.enum(["SMS", "WHATSAPP"]);

export const messageTemplateRouter = router({
  list: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .input(z.object({ channel: channelSchema }))
    .query(({ ctx, input }) => {
      return ctx.db.messageTemplate.findMany({
        where: { organizationId: ctx.session.user.organizationId, channel: input.channel },
        include: { automations: { select: { id: true, name: true, enabled: true } } },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:messaging:manage"))
    .input(
      z.object({
        channel: channelSchema,
        name: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.messageTemplate.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          channel: input.channel,
          name: input.name,
          body: input.body,
          createdByUserId: ctx.session.user.id,
        },
      });
    }),

  update: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:messaging:manage"))
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(1).max(120),
        body: z.string().trim().min(1).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { count } = await ctx.db.messageTemplate.updateMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
        data: { name: input.name, body: input.body },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  delete: protectedProcedure
    .use(requireEntitlement("DENTAL"))
    .use(requireCapability("dental:messaging:manage"))
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Deleting would silently switch those automations to the default
      // text — make the user repoint them first instead.
      const usedBy = await ctx.db.smsAutomation.findMany({
        where: { templateId: input.id, organizationId: ctx.session.user.organizationId },
        select: { name: true },
      });
      if (usedBy.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Bu şablon şu otomatik mesajlarda kullanılıyor: ${usedBy.map((u) => u.name).join(", ")}. Önce onları başka şablona geçirin.`,
        });
      }
      const { count } = await ctx.db.messageTemplate.deleteMany({
        where: { id: input.id, organizationId: ctx.session.user.organizationId },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),
});
