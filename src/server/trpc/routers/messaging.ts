import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure, requireEntitlement, requireCapability } from "@/server/trpc/trpc";
import { branchScopeWhere, type AccessibleBranches } from "@/server/rbac/scope";
import { sealSecret } from "@/server/security/secret-box";
import { listNetgsmHeaders, NetgsmError } from "@/server/sms/netgsm";
import { MessagingError, loadSmsSettings, logMessage, sendSmsAndLog } from "@/server/sms/messaging";
import { planAutomations } from "@/server/sms/automations";
import { renderMessage } from "@/lib/message-render";
import { AUTOMATION_PRESETS, TRIGGER_META, TRIGGERS, type AutomationTrigger } from "@/lib/sms-automation";
import { isValidHhmm } from "@/lib/tr-time";
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
  // With no templateId/body: the clinic's reminder text (its first enabled
  // "randevudan önce" automation's template, else the built-in default).
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
    include: {
      organization: { select: { name: true, phone: true } },
      branch: { select: { name: true, phone: true } },
    },
  });
  if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Hasta bulunamadı." });

  let raw = input.body ?? "";
  if (input.templateId) {
    const tpl = await db.messageTemplate.findFirst({ where: { id: input.templateId, organizationId } });
    if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Şablon bulunamadı." });
    raw = tpl.body;
  } else if (!raw.trim() && input.reminder) {
    const rule = await db.smsAutomation.findFirst({
      where: { organizationId, trigger: "APPOINTMENT_BEFORE", enabled: true },
      select: { template: { select: { body: true } } },
      orderBy: { createdAt: "asc" },
    });
    raw = rule?.template?.body ?? TRIGGER_META.APPOINTMENT_BEFORE.defaultText;
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
          patient,
          clinic: patient.organization,
          branch: patient.branch,
          appointment: appointment ? { startsAt: appointment.startsAt, doctorName: appointment.doctor.user.name } : null,
        })
      : "";
  } catch (e) {
    error = (e as Error).message;
  }

  return {
    patient: { id: patient.id, fullName: patient.fullName, phone: patient.phone, smsOptOut: patient.smsOptOut },
    phoneValid: !!normalizeTrMobile(patient.phone),
    appointment: appointment ? { id: appointment.id, startsAt: appointment.startsAt, doctorName: appointment.doctor.user.name } : null,
    text,
    error,
  };
}

// ---- Automation rule validation ----------------------------------------------

const automationInput = z
  .object({
    name: z.string().trim().min(1, "Kural adı gerekli.").max(120),
    trigger: z.enum(TRIGGERS as [AutomationTrigger, ...AutomationTrigger[]]),
    templateId: z.string().nullable(),
    timingMode: z.enum(["RELATIVE", "FIXED_TIME"]),
    offsetMinutes: z.number().int().min(0).max(60 * 24 * 30),
    dayOffset: z.number().int().min(0).max(60),
    sendTime: z.string().nullable(),
    recallDays: z.number().int().min(7).max(1095).nullable(),
    enabled: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    const meta = TRIGGER_META[v.trigger];
    if (!meta.modes.includes(v.timingMode)) {
      ctx.addIssue({ code: "custom", message: "Bu tetikleyici için geçersiz zamanlama türü." });
    }
    const needsTime = v.timingMode === "FIXED_TIME";
    if (needsTime && (!v.sendTime || !isValidHhmm(v.sendTime))) {
      ctx.addIssue({ code: "custom", message: "Gönderim saati SS:DD biçiminde olmalı (ör. 18:00)." });
    }
    if (v.trigger === "APPOINTMENT_BEFORE" && v.timingMode === "RELATIVE" && v.offsetMinutes < 15) {
      ctx.addIssue({ code: "custom", message: "Randevudan en az 15 dakika önce gönderilmeli." });
    }
    if (v.trigger === "RECALL" && !v.recallDays) {
      ctx.addIssue({ code: "custom", message: "Kontrol hatırlatması için gün sayısı gerekli." });
    }
  });

function normalizeAutomation(v: z.infer<typeof automationInput>) {
  return {
    ...v,
    sendTime: v.timingMode === "FIXED_TIME" ? v.sendTime : null,
    offsetMinutes: v.timingMode === "RELATIVE" ? v.offsetMinutes : 0,
    dayOffset: v.timingMode === "FIXED_TIME" ? v.dayOffset : 0,
    recallDays: v.trigger === "RECALL" ? v.recallDays : null,
  };
}

async function assertSmsTemplate(db: typeof Db, organizationId: string, templateId: string | null) {
  if (!templateId) return;
  const tpl = await db.messageTemplate.findFirst({ where: { id: templateId, organizationId, channel: "SMS" } });
  if (!tpl) throw new TRPCError({ code: "NOT_FOUND", message: "Şablon bulunamadı." });
}

export const messagingRouter = router({
  // Lightweight "is SMS set up?" for every user of the page — the page only
  // shows templates/automations/sending once the account is connected.
  smsStatus: dental.query(async ({ ctx }) => {
    const s = await ctx.db.smsSettings.findUnique({
      where: { organizationId: ctx.session.user.organizationId },
      select: { msgheader: true },
    });
    return { connected: !!s, msgheader: s?.msgheader ?? null };
  }),

  // ---- SMS account (NetGSM) ------------------------------------------------

  smsSettings: settingsProc.query(async ({ ctx }) => {
    const settings = await ctx.db.smsSettings.findUnique({ where: { organizationId: ctx.session.user.organizationId } });
    return {
      connected: !!settings,
      provider: settings?.provider ?? "NETGSM",
      username: settings?.username ?? "",
      msgheader: settings?.msgheader ?? "",
      lastVerifiedAt: settings?.lastVerifiedAt ?? null,
      // Shown so clinics that enable NetGSM's IP restriction know what to allow.
      serverIp: process.env.SMS_OUTBOUND_IP || null,
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
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const existing = await loadSmsSettings(ctx.db, organizationId);
      const password = input.password || existing?.creds.password;
      if (!password) throw new TRPCError({ code: "BAD_REQUEST", message: "Şifre gerekli." });

      // Verify before saving so a typo is caught now, not when tomorrow's
      // reminders start failing.
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
        lastVerifiedAt: new Date(),
      };
      await ctx.db.smsSettings.upsert({ where: { organizationId }, create: { organizationId, ...data }, update: data });
      return { success: true, firstTime: !existing };
    }),

  smsDisconnect: settingsProc.mutation(async ({ ctx }) => {
    const organizationId = ctx.session.user.organizationId;
    // Automations stay (so reconnecting restores them) but are switched off.
    await ctx.db.$transaction([
      ctx.db.smsSettings.deleteMany({ where: { organizationId } }),
      ctx.db.smsAutomation.updateMany({ where: { organizationId }, data: { enabled: false } }),
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

  // ---- Automations ("Otomatik Mesajlar") -----------------------------------

  automations: settingsProc.query(async ({ ctx }) => {
    const organizationId = ctx.session.user.organizationId;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [rules, stats] = await Promise.all([
      ctx.db.smsAutomation.findMany({
        where: { organizationId },
        include: { template: { select: { id: true, name: true, body: true } } },
        orderBy: { createdAt: "asc" },
      }),
      ctx.db.messageLog.groupBy({
        by: ["automationId", "status"],
        where: { organizationId, automationId: { not: null }, createdAt: { gte: since } },
        _count: { _all: true },
      }),
    ]);
    return rules.map((r) => {
      const mine = stats.filter((s) => s.automationId === r.id);
      const count = (status: string) => mine.find((s) => s.status === status)?._count._all ?? 0;
      return { ...r, stats30d: { sent: count("SENT"), failed: count("FAILED"), skipped: count("SKIPPED") } };
    });
  }),

  automationCreate: settingsProc.input(automationInput).mutation(async ({ ctx, input }) => {
    const organizationId = ctx.session.user.organizationId;
    await assertSmsTemplate(ctx.db, organizationId, input.templateId);
    return ctx.db.smsAutomation.create({ data: { organizationId, ...normalizeAutomation(input), activeSince: new Date() } });
  }),

  automationUpdate: settingsProc
    .input(z.object({ id: z.string(), data: automationInput }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const existing = await ctx.db.smsAutomation.findFirst({ where: { id: input.id, organizationId } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await assertSmsTemplate(ctx.db, organizationId, input.data.templateId);
      const next = normalizeAutomation(input.data);
      // Re-timing or re-enabling restarts the "don't send for missed events"
      // clock; renaming or swapping the text doesn't.
      const retimed =
        existing.trigger !== next.trigger ||
        existing.timingMode !== next.timingMode ||
        existing.offsetMinutes !== next.offsetMinutes ||
        existing.dayOffset !== next.dayOffset ||
        existing.sendTime !== next.sendTime ||
        existing.recallDays !== next.recallDays ||
        (!existing.enabled && next.enabled);
      await ctx.db.smsAutomation.update({
        where: { id: existing.id },
        data: { ...next, ...(retimed ? { activeSince: new Date() } : {}) },
      });
      return { success: true };
    }),

  automationSetEnabled: settingsProc
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = ctx.session.user.organizationId;
      const { count } = await ctx.db.smsAutomation.updateMany({
        where: { id: input.id, organizationId },
        data: { enabled: input.enabled, ...(input.enabled ? { activeSince: new Date() } : {}) },
      });
      if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
      return { success: true };
    }),

  automationDelete: settingsProc.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const { count } = await ctx.db.smsAutomation.deleteMany({
      where: { id: input.id, organizationId: ctx.session.user.organizationId },
    });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND" });
    return { success: true };
  }),

  // One click: creates a template with the preset's default text plus the
  // rule using it, so the clinic can then just tweak the wording.
  automationFromPreset: settingsProc.input(z.object({ key: z.string() })).mutation(async ({ ctx, input }) => {
    const preset = AUTOMATION_PRESETS.find((p) => p.key === input.key);
    if (!preset) throw new TRPCError({ code: "NOT_FOUND" });
    const organizationId = ctx.session.user.organizationId;
    return ctx.db.$transaction(async (tx) => {
      const template = await tx.messageTemplate.create({
        data: {
          organizationId,
          channel: "SMS",
          name: preset.name,
          body: TRIGGER_META[preset.trigger].defaultText,
          createdByUserId: ctx.session.user.id,
        },
      });
      return tx.smsAutomation.create({
        data: {
          organizationId,
          name: preset.name,
          trigger: preset.trigger,
          timingMode: preset.timingMode,
          offsetMinutes: preset.offsetMinutes,
          dayOffset: preset.dayOffset,
          sendTime: preset.sendTime,
          recallDays: preset.recallDays,
          templateId: template.id,
          enabled: true,
          activeSince: new Date(),
        },
      });
    });
  }),

  // Dry run — who gets what, when, over the next N hours.
  automationPlan: settingsProc
    .input(z.object({ hours: z.number().int().min(1).max(24 * 7).default(48) }))
    .query(({ ctx, input }) => planAutomations(ctx.session.user.organizationId, input.hours)),

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
        kind: input.reminder ? "REMINDER" : "MANUAL",
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
      await logMessage(ctx.db, {
        organizationId,
        channel: "WHATSAPP",
        status: "OPENED",
        kind: input.kind,
        phone: c.patient.phone,
        body: c.text,
        patientId: c.patient.id,
        appointmentId: c.appointment?.id,
        sentByUserId: ctx.session.user.id,
      });
      return { url };
    }),

  // Upcoming appointments with their last message per channel — WhatsApp's
  // one-click "Hatırlatmalar" list.
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
        patient: { select: { id: true, fullName: true, phone: true, smsOptOut: true } },
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
      lastSms: a.messageLogs.find((m) => m.channel === "SMS") ?? null,
      lastWhatsapp: a.messageLogs.find((m) => m.channel === "WHATSAPP") ?? null,
    }));
  }),

  history: sendProc
    .input(
      z.object({
        channel: z.enum(["SMS", "WHATSAPP"]),
        status: z.enum(["SENT", "FAILED", "OPENED", "SKIPPED"]).optional(),
        automationId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const logs = await ctx.db.messageLog.findMany({
        where: {
          organizationId: ctx.session.user.organizationId,
          channel: input.channel,
          ...(input.status ? { status: input.status } : {}),
          ...(input.automationId ? { automationId: input.automationId } : {}),
        },
        include: {
          patient: { select: { fullName: true } },
          sentBy: { select: { name: true } },
          automation: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      let nextCursor: string | undefined;
      if (logs.length > input.limit) nextCursor = logs.pop()!.id;
      return { logs, nextCursor };
    }),
});
