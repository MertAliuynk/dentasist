import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, type AccessibleBranches } from "@/server/rbac/scope";
import { sealSecret } from "@/server/security/secret-box";
import { listNetgsmHeaders, NetgsmError } from "@/server/sms/netgsm";
import {
  DEFAULT_REMINDER_TEXT,
  MessagingError,
  loadSmsSettings,
  logWhatsappOpen,
  renderMessage,
  sendSmsAndLog,
} from "@/server/sms/messaging";
import { normalizeTrMobile, whatsappLink } from "@/lib/phone";
import type { db as Db } from "@/server/db";

const dental = protectedProcedure.use(requireEntitlement("DENTAL"));
const settingsProc = dental.use(requireCapability("dental:messaging:settings"));
const sendProc = dental.use(requireCapability("dental:messaging:send"));

function toTrpcError(e: unknown): never {
  if (e instanceof MessagingError || e instanceof NetgsmError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: e.message });
  }
  throw e;
}

const composeInput = z.object({
  patientId: z.string(),
  templateId: z.string().optional(),
  body: z.string().trim().max(1000).optional(),
  // Omit → the patient's next upcoming appointment (if any) is used.
  appointmentId: z.string().optional(),
  // With no templateId/body: use the clinic's reminder text (SMS settings'
  // chosen template, else the built-in default).
  reminder: z.boolean().optional(),
});

/**
 * Resolves patient + template/free text + appointment into the final text.
 * Doesn't throw on a missing appointment — returns `error` instead so the
 * compose screen can show it inline while the user is still editing.
 */
async function compose(
  db: typeof Db,
  organizationId: string,
  accessibleBranchIds: AccessibleBranches,
  input: z.infer<typeof composeInput>,
) {
  const patient = await db.patient.findFirst({
    where: { id: input.patientId, deletedAt: null, ...branchScopeWhere(organizationId, accessibleBranchIds) },
    include: { organization: { select: { name: true } } },
  });
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });

  let raw = input.body ?? "";
  if (input.templateId) {
    const tpl = await db.messageTemplate.findFirst({ where: { id: input.templateId, organizationId } });
    if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Şablon bulunamadı." });
    raw = tpl.body;
  } else if (!raw.trim() && input.reminder) {
    const settings = await db.smsSettings.findUnique({
      where: { organizationId },
      select: { reminderTemplate: { select: { body: true } } },
    });
    raw = settings?.reminderTemplate?.body ?? DEFAULT_REMINDER_TEXT;
  }

  const appointment = await db.appointment.findFirst({
    where: {
      organizationId,
      patientId: patient.id,
      ...(input.appointmentId ? { id: input.appointmentId } : { startsAt: { gt: new Date() }, status: "SCHEDULED" }),
    },
    include: { doctor: { include: { user: { select: { name: true } } } } },
    orderBy: { startsAt: "asc" },
  });

  let text = "";
  let error: string | null = null;
  try {
    text = raw.trim()
      ? renderMessage(raw, {
          patientName: patient.fullName,
          clinicName: patient.organization.name,
          appointment: appointment ? { startsAt: appointment.startsAt, doctorName: appointment.doctor.user.name } : null,
        })
      : "";
  } catch (e) {
    error = (e as Error).message;
  }

  return {
    patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone },
    phoneValid: !!normalizeTrMobile(patient.phone),
    appointment: appointment ? { id: appointment.id, startsAt: appointment.startsAt, doctorName: appointment.doctor.user.name } : null,
    text,
    error,
  };
}

export const messagingRouter = router({
  // ---- SMS account (NetGSM) ------------------------------------------------

  smsSettings: settingsProc.query(async ({ ctx }) => {
    const organizationId = ctx.session.user.organizationId;
    const [settings, org] = await Promise.all([
      ctx.db.smsSettings.findUnique({ where: { organizationId } }),
      ctx.db.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { smsRemindersEnabled: true } }),
    ]);
    return {
      connected: !!settings,
      provider: settings?.provider ?? "NETGSM",
      username: settings?.username ?? "",
      msgheader: settings?.msgheader ?? "",
      reminderHoursBefore: settings?.reminderHoursBefore ?? 24,
      reminderTemplateId: settings?.reminderTemplateId ?? null,
      lastVerifiedAt: settings?.lastVerifiedAt ?? null,
      remindersEnabled: org.smsRemindersEnabled,
      defaultReminderText: DEFAULT_REMINDER_TEXT,
    };
  }),

  // Step 1 of connecting: check the credentials and fetch the account's
  // approved headers so the user picks one instead of typing it. Password
  // may be omitted when changing settings of an already-connected account.
  smsFetchHeaders: settingsProc
    .input(z.object({ username: z.string().trim().min(1).max(60), password: z.string().max(100).optional() }))
    .mutation(async ({ ctx, input }) => {
      let password = input.password;
      if (!password) {
        const stored = await loadSmsSettings(ctx.db, ctx.session.user.organizationId);
        if (!stored) throw new TRPCError({ code: "BAD_REQUEST", message: "Şifre gerekli." });
        password = stored.creds.password;
      }
      try {
        return { headers: await listNetgsmHeaders({ username: input.username, password }) };
      } catch (e) {
        toTrpcError(e);
      }
    }),

  smsSave: settingsProc
    .input(
      z.object({
        username: z.string().trim().min(1).max(60),
        password: z.string().max(100).optional(),
        msgheader: z.string().trim().min(1).max(20),
        reminderHoursBefore: z.number().int().min(1).max(72),
        reminderTemplateId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const existing = await loadSmsSettings(ctx.db, organizationId);
      const password = input.password || existing?.creds.password;
      if (!password) throw new TRPCError({ code: "BAD_REQUEST", message: "Şifre gerekli." });

      if (input.reminderTemplateId) {
        const tpl = await ctx.db.messageTemplate.findFirst({
          where: { id: input.reminderTemplateId, organizationId, channel: "SMS" },
        });
        if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Hatırlatma şablonu bulunamadı." });
      }

      // Verify before saving so a typo is caught now, not at 9am tomorrow
      // when the reminders start failing.
      let headers: string[];
      try {
        headers = await listNetgsmHeaders({ username: input.username, password });
      } catch (e) {
        toTrpcError(e);
      }
      if (headers.length > 0 && !headers.includes(input.msgheader)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `"${input.msgheader}" başlığı NetGSM hesabınızda yok. Tanımlı başlıklar: ${headers.join(", ")}`,
        });
      }

      const data = {
        username: input.username,
        passwordEnc: sealSecret(password),
        msgheader: input.msgheader,
        reminderHoursBefore: input.reminderHoursBefore,
        reminderTemplateId: input.reminderTemplateId,
        lastVerifiedAt: new Date(),
      };
      await ctx.db.smsSettings.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
      return { success: true };
    }),

  smsSetReminders: settingsProc.input(z.object({ enabled: z.boolean() })).mutation(async ({ ctx, input }) => {
    const organizationId = ctx.session.user.organizationId;
    if (input.enabled) {
      const settings = await ctx.db.smsSettings.findUnique({ where: { organizationId } });
      if (!settings) throw new TRPCError({ code: "BAD_REQUEST", message: "Önce NetGSM hesabınızı bağlayın." });
    }
    await ctx.db.organization.update({ where: { id: organizationId }, data: { smsRemindersEnabled: input.enabled } });
    return { success: true };
  }),

  smsDisconnect: settingsProc.mutation(async ({ ctx }) => {
    const organizationId = ctx.session.user.organizationId;
    await ctx.db.$transaction([
      ctx.db.smsSettings.deleteMany({ where: { organizationId } }),
      ctx.db.organization.update({ where: { id: organizationId }, data: { smsRemindersEnabled: false } }),
    ]);
    return { success: true };
  }),

  smsSendTest: settingsProc.input(z.object({ phone: z.string().trim().min(10).max(20) })).mutation(async ({ ctx, input }) => {
    try {
      await sendSmsAndLog(ctx.db, {
        organizationId: ctx.session.user.organizationId,
        phone: input.phone,
        body: `${ctx.session.user.organizationName} - Dentasist SMS bağlantınız çalışıyor.`,
        kind: "TEST",
        sentByUserId: ctx.session.user.id,
      });
      return { success: true };
    } catch (e) {
      toTrpcError(e);
    }
  }),

  // ---- Composing & sending -------------------------------------------------

  preview: sendProc.input(composeInput).query(({ ctx, input }) =>
    compose(ctx.db, ctx.session.user.organizationId, ctx.accessibleBranchIds, input),
  ),

  sendSms: sendProc.input(composeInput).mutation(async ({ ctx, input }) => {
    const organizationId = ctx.session.user.organizationId;
    const c = await compose(ctx.db, organizationId, ctx.accessibleBranchIds, input);
    if (c.error) throw new TRPCError({ code: "BAD_REQUEST", message: c.error });
    if (!c.text) throw new TRPCError({ code: "BAD_REQUEST", message: "Mesaj boş olamaz." });
    try {
      await sendSmsAndLog(ctx.db, {
        organizationId,
        phone: c.patient.phone,
        body: c.text,
        kind: "MANUAL",
        patientId: c.patient.id,
        appointmentId: c.appointment?.id,
        sentByUserId: ctx.session.user.id,
      });
      return { success: true };
    } catch (e) {
      toTrpcError(e);
    }
  }),

  // WhatsApp: returns the wa.me link for the browser to open, and records it.
  openWhatsapp: sendProc
    .input(composeInput.extend({ kind: z.enum(["MANUAL", "REMINDER"]).default("MANUAL") }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const c = await compose(ctx.db, organizationId, ctx.accessibleBranchIds, input);
      if (c.error) throw new TRPCError({ code: "BAD_REQUEST", message: c.error });
      if (!c.text) throw new TRPCError({ code: "BAD_REQUEST", message: "Mesaj boş olamaz." });
      const url = whatsappLink(c.patient.phone, c.text);
      if (!url) throw new TRPCError({ code: "BAD_REQUEST", message: `Hastanın telefonu geçerli bir cep numarası değil: ${c.patient.phone}` });
      await logWhatsappOpen(ctx.db, {
        organizationId,
        phone: c.patient.phone,
        body: c.text,
        patientId: c.patient.id,
        appointmentId: c.appointment?.id,
        sentByUserId: ctx.session.user.id,
        kind: input.kind,
      });
      return { url };
    }),

  // Upcoming appointments with their reminder status — the "Hatırlatmalar"
  // list on both pages (SMS: shows what the job sent; WhatsApp: one-click send).
  upcoming: sendProc.input(z.object({ days: z.number().int().min(0).max(14).default(1) })).query(async ({ ctx, input }) => {
    const organizationId = ctx.session.user.organizationId;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + input.days);
    end.setHours(23, 59, 59, 999);

    const appointments = await ctx.db.appointment.findMany({
      where: {
        ...branchScopeWhere(organizationId, ctx.accessibleBranchIds),
        status: "SCHEDULED",
        startsAt: { gt: now, lte: end },
        patient: { deletedAt: null },
      },
      include: {
        patient: { select: { id: true, fullName: true, phone: true } },
        doctor: { include: { user: { select: { name: true } } } },
        messageLogs: { orderBy: { createdAt: "desc" }, select: { channel: true, status: true, kind: true, createdAt: true, errorMessage: true } },
      },
      orderBy: { startsAt: "asc" },
      take: 300,
    });
    return appointments.map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      patient: a.patient,
      phoneValid: !!normalizeTrMobile(a.patient.phone),
      doctorName: a.doctor.user.name,
      reminderSentAt: a.reminderSentAt,
      lastSms: a.messageLogs.find((m) => m.channel === "SMS") ?? null,
      lastWhatsapp: a.messageLogs.find((m) => m.channel === "WHATSAPP") ?? null,
    }));
  }),

  history: sendProc
    .input(z.object({ channel: z.enum(["SMS", "WHATSAPP"]), cursor: z.string().optional(), limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.messageLog.findMany({
        where: { organizationId: ctx.session.user.organizationId, channel: input.channel },
        include: { patient: { select: { fullName: true } }, sentBy: { select: { name: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      let nextCursor: string | undefined;
      if (logs.length > input.limit) nextCursor = logs.pop()!.id;
      return { logs, nextCursor };
    }),
});
