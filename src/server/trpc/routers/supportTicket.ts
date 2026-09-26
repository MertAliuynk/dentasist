import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import {
  MESSAGE_INCLUDE,
  assertOwnKeys,
  attachmentInput,
  errorContextInput,
  isUnread,
  signUpload,
  uploadRequestInput,
  withAttachmentUrls,
} from "@/server/support/support";

// Support tickets are intentionally open to every authenticated tenant
// account regardless of role/capability — anyone in the clinic should be
// able to raise a support request, not just admins.

const PRIORITY = z.enum(["DUSUK", "NORMAL", "YUKSEK", "ACIL"]);
const CATEGORY = z.enum(["TEKNIK", "FATURALAMA", "OZELLIK_TALEBI", "DIGER"]);

export const supportTicketRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const tickets = await ctx.db.supportTicket.findMany({
      where: { organizationId: ctx.session.user.organizationId },
      include: {
        createdBy: { select: { name: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, kind: true, authorPlatformUserId: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      category: t.category,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      createdByName: t.createdBy.name,
      messageCount: t._count.messages,
      lastMessage: t.messages[0] ? { body: t.messages[0].body, fromStaff: !!t.messages[0].authorPlatformUserId } : null,
      unread: isUnread(t.lastStaffMsgAt, t.customerReadAt),
      fromError: !!t.errorContext,
    }));
  }),

  // Opening a ticket marks the support team's replies as read.
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const ticket = await ctx.db.supportTicket.findFirst({
      where: { id: input.id, organizationId: ctx.session.user.organizationId },
      include: { createdBy: { select: { name: true } }, messages: { orderBy: { createdAt: "asc" }, include: MESSAGE_INCLUDE } },
    });
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Destek talebi bulunamadı." });
    if (isUnread(ticket.lastStaffMsgAt, ticket.customerReadAt)) {
      await ctx.db.supportTicket.update({ where: { id: ticket.id }, data: { customerReadAt: new Date() } });
    }
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt,
      createdByName: ticket.createdBy.name,
      attachmentsAllowed: ticket.attachmentsAllowed,
      errorContext: ticket.errorContext as Record<string, string> | null,
      messages: await withAttachmentUrls(ticket.messages),
    };
  }),

  // Header bell: tickets with a support reply the clinic hasn't seen yet.
  unread: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.supportTicket.findMany({
      where: { organizationId: ctx.session.user.organizationId, lastStaffMsgAt: { not: null } },
      select: { id: true, subject: true, lastStaffMsgAt: true, customerReadAt: true, status: true },
      orderBy: { lastStaffMsgAt: "desc" },
      take: 50,
    });
    const items = rows.filter((r) => isUnread(r.lastStaffMsgAt, r.customerReadAt));
    return {
      count: items.length,
      items: items.slice(0, 8).map((r) => ({ id: r.id, subject: r.subject, at: r.lastStaffMsgAt!, status: r.status })),
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        subject: z.string().trim().min(3, "Konu en az 3 karakter olmalı.").max(200),
        message: z.string().trim().min(3, "Mesaj en az 3 karakter olmalı.").max(4000),
        priority: PRIORITY.default("NORMAL"),
        category: CATEGORY.default("DIGER"),
        errorContext: errorContextInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const now = new Date();
      return ctx.db.supportTicket.create({
        data: {
          organizationId: ctx.session.user.organizationId,
          createdByUserId: ctx.session.user.id,
          subject: input.subject,
          priority: input.priority,
          category: input.category,
          errorContext: input.errorContext ?? undefined,
          createdIp: ctx.clientIp,
          lastCustomerMsgAt: now,
          customerReadAt: now,
          messages: { create: { authorUserId: ctx.session.user.id, body: input.message, createdIp: ctx.clientIp } },
        },
        select: { id: true },
      });
    }),

  requestUpload: protectedProcedure.input(uploadRequestInput).mutation(async ({ ctx, input }) => {
    const ticket = await ctx.db.supportTicket.findFirst({
      where: { id: input.ticketId, organizationId: ctx.session.user.organizationId },
      select: { attachmentsAllowed: true, status: true },
    });
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Destek talebi bulunamadı." });
    if (!ticket.attachmentsAllowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Bu talepte görsel gönderimi destek ekibi tarafından açılmadı." });
    }
    return signUpload(ctx.session.user.organizationId, input);
  }),

  reply: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        body: z.string().trim().max(4000),
        attachments: z.array(attachmentInput).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const ticket = await ctx.db.supportTicket.findFirst({ where: { id: input.ticketId, organizationId } });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Destek talebi bulunamadı." });
      if (!input.body && input.attachments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mesaj boş olamaz." });
      }
      if (input.attachments.length > 0) {
        if (!ticket.attachmentsAllowed) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Bu talepte görsel gönderimi açık değil." });
        }
        assertOwnKeys(organizationId, ticket.id, input.attachments);
      }

      const now = new Date();
      await ctx.db.$transaction([
        ctx.db.supportTicketMessage.create({
          data: {
            ticketId: ticket.id,
            authorUserId: ctx.session.user.id,
            body: input.body,
            createdIp: ctx.clientIp,
            attachments: { create: input.attachments },
          },
        }),
        // Any customer message (re)opens the ticket for the support queue.
        ctx.db.supportTicket.update({
          where: { id: ticket.id },
          data: { status: "OPEN", lastCustomerMsgAt: now, customerReadAt: now },
        }),
      ]);
      return { success: true };
    }),

  // "Sorunum çözüldü" — the customer can close their own ticket.
  close: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const ticket = await ctx.db.supportTicket.findFirst({
      where: { id: input.id, organizationId: ctx.session.user.organizationId },
    });
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Destek talebi bulunamadı." });
    await ctx.db.$transaction([
      ctx.db.supportTicketMessage.create({
        data: { ticketId: ticket.id, kind: "SYSTEM", authorUserId: ctx.session.user.id, body: `${ctx.session.user.name} talebi kapattı (sorun çözüldü).` },
      }),
      ctx.db.supportTicket.update({ where: { id: ticket.id }, data: { status: "CLOSED", attachmentsAllowed: false } }),
    ]);
    return { success: true };
  }),
});
