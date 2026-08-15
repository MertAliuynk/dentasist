import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { platformRouter, platformProcedure, requirePlatformCapability, logPlatformAction } from "@/server/trpc/platform-trpc";

export const platformSupportTicketRouter = platformRouter({
  list: platformProcedure
    .use(requirePlatformCapability("platform:org:read"))
    .input(z.object({ status: z.enum(["OPEN", "ANSWERED", "CLOSED"]).optional() }))
    .query(({ ctx, input }) => {
      return ctx.db.supportTicket.findMany({
        where: input.status ? { status: input.status } : undefined,
        include: {
          organization: true,
          createdBy: true,
          messages: { orderBy: { createdAt: "asc" }, include: { authorUser: true, authorPlatformUser: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
    }),

  reply: platformProcedure
    .use(requirePlatformCapability("platform:support:respond"))
    .input(z.object({ ticketId: z.string(), body: z.string().trim().min(1).max(4000) }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          authorPlatformUserId: ctx.platformUser.id,
          body: input.body,
        },
      });
      const updated = await ctx.db.supportTicket.update({
        where: { id: ticket.id },
        data: { status: "ANSWERED" },
      });

      await logPlatformAction(ctx.db, ctx.platformUser.id, "support_ticket.replied", {
        organizationId: ticket.organizationId,
        entityType: "SupportTicket",
        entityId: ticket.id,
      });

      return updated;
    }),

  updateStatus: platformProcedure
    .use(requirePlatformCapability("platform:support:respond"))
    .input(z.object({ ticketId: z.string(), status: z.enum(["OPEN", "ANSWERED", "CLOSED"]) }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.update({
        where: { id: input.ticketId },
        data: { status: input.status },
      });

      await logPlatformAction(ctx.db, ctx.platformUser.id, "support_ticket.status_changed", {
        organizationId: ticket.organizationId,
        entityType: "SupportTicket",
        entityId: ticket.id,
        diff: { status: input.status },
      });

      return ticket;
    }),
});
