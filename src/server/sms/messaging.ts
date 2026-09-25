import type { MessageChannel, MessageKind } from "@prisma/client";
import type { db as Db } from "@/server/db";
import { openSecret } from "@/server/security/secret-box";
import { normalizeTrMobile } from "@/lib/phone";
import { NetgsmError, sendNetgsm } from "@/server/sms/netgsm";

type DB = typeof Db;

export const DEFAULT_REMINDER_TEXT =
  "Sayın {ad}, {randevu_tarihi} günü saat {randevu_saati} {klinik} randevunuzu hatırlatırız. Hekim: {hekim}";

const APPOINTMENT_TOKENS = ["{randevu_tarihi}", "{randevu_saati}", "{hekim}"];
const TZ = "Europe/Istanbul";

export type MessageContext = {
  patientName: string;
  clinicName: string;
  appointment?: { startsAt: Date; doctorName: string } | null;
};

export function usesAppointmentTokens(body: string) {
  return APPOINTMENT_TOKENS.some((t) => body.includes(t));
}

/** Fills {ad}/{klinik}/{randevu_*}/{hekim}; appointment tokens need an appointment. */
export function renderMessage(body: string, ctx: MessageContext): string {
  if (usesAppointmentTokens(body) && !ctx.appointment) {
    throw new Error("Mesajda randevu bilgisi var ama hastanın yaklaşan randevusu yok.");
  }
  const a = ctx.appointment;
  return body
    .replaceAll("{ad}", ctx.patientName)
    .replaceAll("{klinik}", ctx.clinicName)
    .replaceAll("{randevu_tarihi}", a ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeZone: TZ }).format(a.startsAt) : "")
    .replaceAll("{randevu_saati}", a ? new Intl.DateTimeFormat("tr-TR", { timeStyle: "short", timeZone: TZ }).format(a.startsAt) : "")
    .replaceAll("{hekim}", a?.doctorName ?? "")
    .trim();
}

export async function loadSmsSettings(db: DB, organizationId: string) {
  const settings = await db.smsSettings.findUnique({ where: { organizationId } });
  if (!settings) return null;
  return {
    settings,
    creds: { username: settings.username, password: openSecret(settings.passwordEnc) },
  };
}

export class MessagingError extends Error {
  constructor(message: string, readonly transient = false) {
    super(message);
  }
}

/**
 * Sends one SMS through the clinic's own provider account and records it
 * in MessageLog either way. Throws MessagingError on failure (after
 * logging), so callers can surface the reason.
 */
export async function sendSmsAndLog(
  db: DB,
  args: {
    organizationId: string;
    phone: string;
    body: string;
    kind: MessageKind;
    patientId?: string | null;
    appointmentId?: string | null;
    sentByUserId?: string | null;
  },
) {
  const log = (status: "SENT" | "FAILED", extra: { providerRef?: string; errorMessage?: string }) =>
    db.messageLog.create({
      data: {
        organizationId: args.organizationId,
        channel: "SMS",
        kind: args.kind,
        status,
        patientId: args.patientId ?? null,
        appointmentId: args.appointmentId ?? null,
        phone: args.phone,
        body: args.body,
        sentByUserId: args.sentByUserId ?? null,
        ...extra,
      },
    });

  const phone = normalizeTrMobile(args.phone);
  if (!phone) {
    await log("FAILED", { errorMessage: "Geçersiz cep telefonu numarası." });
    throw new MessagingError(`Geçersiz cep telefonu numarası: ${args.phone}`);
  }

  const loaded = await loadSmsSettings(db, args.organizationId);
  if (!loaded) {
    await log("FAILED", { errorMessage: "SMS hesabı bağlı değil." });
    throw new MessagingError("SMS hesabınız bağlı değil. SMS Hizmetleri → Ayarlar'dan NetGSM hesabınızı bağlayın.");
  }

  try {
    const { jobid } = await sendNetgsm(loaded.creds, loaded.settings.msgheader, [{ no: phone, msg: args.body }]);
    return await log("SENT", { providerRef: jobid });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Bilinmeyen hata";
    await log("FAILED", { errorMessage: message });
    throw new MessagingError(message, e instanceof NetgsmError && e.transient);
  }
}

/** Records a WhatsApp click-to-chat open (we can't observe the actual send). */
export async function logWhatsappOpen(
  db: DB,
  args: { organizationId: string; phone: string; body: string; patientId?: string | null; appointmentId?: string | null; sentByUserId: string; kind?: MessageKind },
) {
  const channel: MessageChannel = "WHATSAPP";
  return db.messageLog.create({
    data: {
      organizationId: args.organizationId,
      channel,
      kind: args.kind ?? "MANUAL",
      status: "OPENED",
      phone: args.phone,
      body: args.body,
      patientId: args.patientId ?? null,
      appointmentId: args.appointmentId ?? null,
      sentByUserId: args.sentByUserId,
    },
  });
}
