import type { MessageKind, MessageStatus } from "@prisma/client";
import type { db as Db } from "@/server/db";
import { openSecret } from "@/server/security/secret-box";
import { normalizeTrMobile } from "@/lib/phone";
import { NetgsmError, sendNetgsm } from "@/server/sms/netgsm";

type DB = typeof Db;

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

type LogArgs = {
  organizationId: string;
  phone: string;
  body: string;
  kind: MessageKind;
  patientId?: string | null;
  appointmentId?: string | null;
  automationId?: string | null;
  sentByUserId?: string | null;
};

export function logMessage(
  db: DB,
  args: LogArgs & { channel: "SMS" | "WHATSAPP"; status: MessageStatus; providerRef?: string; errorMessage?: string },
) {
  return db.messageLog.create({
    data: {
      organizationId: args.organizationId,
      channel: args.channel,
      kind: args.kind,
      status: args.status,
      patientId: args.patientId ?? null,
      appointmentId: args.appointmentId ?? null,
      automationId: args.automationId ?? null,
      phone: args.phone,
      body: args.body,
      sentByUserId: args.sentByUserId ?? null,
      providerRef: args.providerRef,
      errorMessage: args.errorMessage,
    },
  });
}

/**
 * Sends one SMS through the clinic's own provider account and records it
 * in MessageLog either way. Throws MessagingError on failure (after
 * logging), so callers can surface the reason.
 */
export async function sendSmsAndLog(db: DB, args: LogArgs) {
  const log = (status: "SENT" | "FAILED", extra: { providerRef?: string; errorMessage?: string }) =>
    logMessage(db, { ...args, channel: "SMS", status, ...extra });

  const phone = normalizeTrMobile(args.phone);
  if (!phone) {
    await log("FAILED", { errorMessage: "Geçersiz cep telefonu numarası." });
    throw new MessagingError(`Geçersiz cep telefonu numarası: ${args.phone}`);
  }

  const loaded = await loadSmsSettings(db, args.organizationId);
  if (!loaded) {
    await log("FAILED", { errorMessage: "SMS hesabı bağlı değil." });
    throw new MessagingError("SMS hesabınız bağlı değil. SMS Hizmetleri → Hesap'tan NetGSM hesabınızı bağlayın.");
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
