import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";

// Support tickets are intentionally open to every authenticated tenant
// account regardless of role/capability — anyone in the clinic should be
// able to raise a support request, not just admins.
export const supportTicketRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.db.supportTicket.findMany({
      where: { organizationId: ctx.session.user.organizationId },
      include: {
        createdBy: true,
        messages: { orderBy: { createdAt: "asc" }, include: { authorUser: true, authorPlatformUser: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().trim().min(3).max(200),
        message: z.string().trim().min(3).max(4000),
        priority: z.enum(["DUSUK", "NORMAL", "YUKSEK", "ACIL"]).default("NORMAL"),
        category: z.enum(["TEKNIK", "FATURALAMA", "OZELLIK_TALEBI", "DIGER"]).default("DIGER"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supportTicket.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          createdByUserId: ctx.session.user.id,
          subject: input.subject,
          priority: input.priority,
          category: input.category,
          createdIp: ctx.clientIp,
          messages: {
            create: {
              authorUserId: ctx.session.user.id,
              body: input.message,
              createdIp: ctx.clientIp,
            },
          },
        },
        include: { messages: true },
      });
    }),

  reply: protectedProcedure
    .input(z.object({ ticketId: z.string(), body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findFirst({
        where: { id: input.ticketId, organizationId: ctx.session.user.organizationId },
      });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorUserId: ctx.session.user.id,
          body: input.body,
          createdIp: ctx.clientIp,
        },
      });

      return ctx.db.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "OPEN" },
      });
    }),
});
