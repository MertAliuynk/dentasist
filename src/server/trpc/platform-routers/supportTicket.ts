import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type { Prisma } from "@prisma/client";
import { platformRouter, platformProcedure, requirePlatformCapability, logPlatformAction } from "@/server/trpc/platform-trpc";
import {
  MESSAGE_INCLUDE,
  assertOwnKeys,
  attachmentInput,
  isUnread,
  signUpload,
  uploadRequestInput,
  withAttachmentUrls,
} from "@/server/support/support";

const STATUS = z.enum(["OPEN", "ANSWERED", "CLOSED"]);
const PRIORITY = z.enum(["DUSUK", "NORMAL", "YUKSEK", "ACIL"]);
const CATEGORY = z.enum(["TEKNIK", "FATURALAMA", "OZELLIK_TALEBI", "DIGER"]);
const PRIORITY_RANK: Record<string, number> = { ACIL: 0, YUKSEK: 1, NORMAL: 2, DUSUK: 3 };
const STATUS_LABEL: Record<string, string> = { OPEN: "Açık", ANSWERED: "Yanıtlandı", CLOSED: "Kapalı" };
const PRIORITY_LABEL: Record<string, string> = { DUSUK: "Düşük", NORMAL: "Normal", YUKSEK: "Yüksek", ACIL: "Acil" };

const readProc = platformProcedure.use(requirePlatformCapability("platform:org:read"));
const respondProc = platformProcedure.use(requirePlatformCapability("platform:support:respond"));

export const platformSupportTicketRouter = platformRouter({
  list: readProc
    .input(
      z.object({
        status: STATUS.optional(),
        category: CATEGORY.optional(),
        priority: PRIORITY.optional(),
        search: z.string().trim().max(120).optional(),
        sort: z.enum(["WAITING", "PRIORITY", "RECENT"]).default("WAITING"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.SupportTicketWhereInput = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.search
          ? {
              OR: [
                { subject: { contains: input.search, mode: "insensitive" } },
                { organization: { name: { contains: input.search, mode: "insensitive" } } },
                { createdBy: { name: { contains: input.search, mode: "insensitive" } } },
                { createdBy: { email: { contains: input.search, mode: "insensitive" } } },
                { id: input.search },
              ],
            }
          : {}),
      };
      const [rows, counts] = await Promise.all([
        ctx.db.supportTicket.findMany({
          where,
          include: {
            organization: { select: { id: true, name: true } },
            createdBy: { select: { name: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, authorPlatformUserId: true, kind: true } },
            _count: { select: { messages: true } },
          },
          orderBy: { updatedAt: "desc" },
          take: 300,
        }),
        // Tab counts ignore the status filter itself so every tab shows its size.
        ctx.db.supportTicket.groupBy({
          by: ["status"],
          where: { ...where, status: undefined },
          _count: { _all: true },
        }),
      ]);

      const items = rows.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        category: t.category,
        organization: t.organization,
        createdByName: t.createdBy.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        messageCount: t._count.messages,
        lastMessage: t.messages[0] ? { body: t.messages[0].body, fromStaff: !!t.messages[0].authorPlatformUserId } : null,
        unread: isUnread(t.lastCustomerMsgAt, t.staffReadAt),
        // How long the customer has been waiting for us (open tickets only).
        waitingSince: t.status === "OPEN" ? (t.lastCustomerMsgAt ?? t.createdAt) : null,
        attachmentsAllowed: t.attachmentsAllowed,
        fromError: !!t.errorContext,
      }));

      if (input.sort === "PRIORITY") {
        items.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || +b.updatedAt - +a.updatedAt);
      } else if (input.sort === "WAITING") {
        // Waiting customers first (longest wait on top), then everything else by recency.
        items.sort((a, b) => {
          if (a.waitingSince && b.waitingSince) {
            return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || +a.waitingSince - +b.waitingSince;
          }
          if (a.waitingSince) return -1;
          if (b.waitingSince) return 1;
          return +b.updatedAt - +a.updatedAt;
        });
      }

      const countBy = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>;
      return {
        items,
        counts: { OPEN: countBy.OPEN ?? 0, ANSWERED: countBy.ANSWERED ?? 0, CLOSED: countBy.CLOSED ?? 0 },
      };
    }),

  get: readProc.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const ticket = await ctx.db.supportTicket.findUnique({
      where: { id: input.id },
      include: {
        organization: {
          select: { id: true, name: true, phone: true, subscription: { select: { status: true, currentPeriodEnd: true, plan: { select: { name: true } } } } },
        },
        createdBy: { select: { id: true, name: true, email: true, phone: true } },
        messages: { orderBy: { createdAt: "asc" }, include: MESSAGE_INCLUDE },
      },
    });
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Talep bulunamadı." });
    if (isUnread(ticket.lastCustomerMsgAt, ticket.staffReadAt)) {
      await ctx.db.supportTicket.update({ where: { id: ticket.id }, data: { staffReadAt: new Date() } });
    }
    const [otherTickets, recentErrors] = await Promise.all([
      ctx.db.supportTicket.count({ where: { organizationId: ticket.organizationId, id: { not: ticket.id } } }),
      ctx.db.activityLog.count({
        where: { organizationId: ticket.organizationId, ok: false, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      }),
    ]);
    return {
      id: ticket.id,
      subject: ticket.subject,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      createdAt: ticket.createdAt,
      createdIp: ticket.createdIp,
      attachmentsAllowed: ticket.attachmentsAllowed,
      errorContext: ticket.errorContext as Record<string, string> | null,
      organization: ticket.organization,
      createdBy: ticket.createdBy,
      otherTickets,
      recentErrors,
      messages: await withAttachmentUrls(ticket.messages),
    };
  }),

  // Sidebar badge + header bell.
  unread: readProc.query(async ({ ctx }) => {
    const rows = await ctx.db.supportTicket.findMany({
      where: { status: "OPEN" },
      select: {
        id: true,
        subject: true,
        priority: true,
        lastCustomerMsgAt: true,
        staffReadAt: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    const unread = rows.filter((r) => isUnread(r.lastCustomerMsgAt, r.staffReadAt));
    return {
      open: rows.length,
      unreadCount: unread.length,
      items: unread.slice(0, 8).map((r) => ({
        id: r.id,
        subject: r.subject,
        priority: r.priority,
        organizationName: r.organization.name,
        at: r.lastCustomerMsgAt ?? r.createdAt,
      })),
    };
  }),

  requestUpload: respondProc.input(uploadRequestInput).mutation(async ({ ctx, input }) => {
    const ticket = await ctx.db.supportTicket.findUnique({ where: { id: input.ticketId }, select: { organizationId: true } });
    if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Talep bulunamadı." });
    return signUpload(ticket.organizationId, input);
  }),

  reply: respondProc
    .input(
      z.object({
        ticketId: z.string(),
        body: z.string().trim().max(4000),
        attachments: z.array(attachmentInput).default([]),
        closeAfter: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Talep bulunamadı." });
      if (!input.body && input.attachments.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Mesaj boş olamaz." });
      }
      assertOwnKeys(ticket.organizationId, ticket.id, input.attachments);

      const now = new Date();
      await ctx.db.$transaction([
        ctx.db.supportTicketMessage.create({
          data: {
            ticketId: ticket.id,
            authorPlatformUserId: ctx.platformUser.id,
            body: input.body,
            attachments: { create: input.attachments },
          },
        }),
        ...(input.closeAfter
          ? [
              ctx.db.supportTicketMessage.create({
                data: { ticketId: ticket.id, kind: "SYSTEM" as const, authorPlatformUserId: ctx.platformUser.id, body: "Talep destek ekibi tarafından kapatıldı." },
              }),
            ]
          : []),
        ctx.db.supportTicket.update({
          where: { id: ticket.id },
          data: {
            status: input.closeAfter ? "CLOSED" : "ANSWERED",
            lastStaffMsgAt: now,
            staffReadAt: now,
            ...(input.closeAfter ? { attachmentsAllowed: false } : {}),
          },
        }),
      ]);

      await logPlatformAction(ctx.db, ctx.platformUser.id, "support_ticket.replied", {
        organizationId: ticket.organizationId,
        entityType: "SupportTicket",
        entityId: ticket.id,
      });
      return { success: true };
    }),

  // "Fotoğraf göndermeyi aç": flips the per-ticket switch and posts a note
  // the customer sees (and gets notified about).
  setAttachmentsAllowed: respondProc
    .input(z.object({ ticketId: z.string(), allowed: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Talep bulunamadı." });
      if (ticket.attachmentsAllowed === input.allowed) return { success: true };
      const now = new Date();
      await ctx.db.$transaction([
        ctx.db.supportTicketMessage.create({
          data: {
            ticketId: ticket.id,
            kind: "SYSTEM",
            authorPlatformUserId: ctx.platformUser.id,
            body: input.allowed
              ? "Destek ekibi bu talep için görsel göndermeyi açtı. Mesaj kutusundaki 📎 düğmesiyle ekran görüntüsü veya fotoğraf ekleyebilirsiniz (ekran görüntüsünü doğrudan yapıştırabilirsiniz)."
              : "Görsel gönderimi kapatıldı.",
          },
        }),
        ctx.db.supportTicket.update({
          where: { id: ticket.id },
          data: {
            attachmentsAllowed: input.allowed,
            ...(input.allowed ? { lastStaffMsgAt: now, staffReadAt: now } : {}),
          },
        }),
      ]);
      await logPlatformAction(ctx.db, ctx.platformUser.id, "support_ticket.attachments_toggled", {
        organizationId: ticket.organizationId,
        entityType: "SupportTicket",
        entityId: ticket.id,
        diff: { allowed: input.allowed },
      });
      return { success: true };
    }),

  update: respondProc
    .input(z.object({ ticketId: z.string(), status: STATUS.optional(), priority: PRIORITY.optional(), category: CATEGORY.optional() }))
    .mutation(async ({ ctx, input }) => {
      const ticket = await ctx.db.supportTicket.findUnique({ where: { id: input.ticketId } });
      if (!ticket) throw new TRPCError({ code: "NOT_FOUND", message: "Talep bulunamadı." });

      const notes: string[] = [];
      if (input.status && input.status !== ticket.status) notes.push(`Durum: ${STATUS_LABEL[input.status]}`);
      if (input.priority && input.priority !== ticket.priority) notes.push(`Öncelik: ${PRIORITY_LABEL[input.priority]}`);

      await ctx.db.$transaction([
        ...(notes.length
          ? [
              ctx.db.supportTicketMessage.create({
                data: { ticketId: ticket.id, kind: "SYSTEM" as const, authorPlatformUserId: ctx.platformUser.id, body: `${ctx.platformUser.name} güncelledi — ${notes.join(", ")}` },
              }),
            ]
          : []),
        ctx.db.supportTicket.update({
          where: { id: ticket.id },
          data: {
            ...(input.status ? { status: input.status } : {}),
            ...(input.priority ? { priority: input.priority } : {}),
            ...(input.category ? { category: input.category } : {}),
            ...(input.status === "CLOSED" ? { attachmentsAllowed: false } : {}),
          },
        }),
      ]);
      await logPlatformAction(ctx.db, ctx.platformUser.id, "support_ticket.updated", {
        organizationId: ticket.organizationId,
        entityType: "SupportTicket",
        entityId: ticket.id,
        diff: input,
      });
      return { success: true };
    }),
});
