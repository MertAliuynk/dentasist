import { db } from "@/server/db";
import { DEFAULT_REMINDER_TEXT, MessagingError, renderMessage, sendSmsAndLog } from "@/server/sms/messaging";
import { isSubscriptionUsable } from "@/lib/subscription-access";

const HOUR_MS = 60 * 60 * 1000;

/**
 * One pass of the automatic SMS reminder job: for every clinic with
 * reminders on and an SMS account connected, texts each still-SCHEDULED
 * appointment that starts within the clinic's reminder window.
 *
 * Exactly-once: each appointment is claimed by atomically setting
 * reminderSentAt (updateMany … where reminderSentAt IS NULL) before
 * sending, so overlapping runs / multiple instances can't double-send. A
 * transient provider failure releases the claim so the next run retries;
 * a permanent one (bad credentials, header, number) keeps it — the failure
 * is visible in Gönderim Geçmişi instead of repeating every 5 minutes.
 */
export async function runDueReminders(now = new Date()) {
  const clinics = await db.organization.findMany({
    where: { smsRemindersEnabled: true, smsSettings: { isNot: null } },
    select: {
      id: true,
      name: true,
      subscription: { select: { status: true, currentPeriodEnd: true, entitlements: true } },
      smsSettings: { select: { reminderHoursBefore: true, reminderTemplate: { select: { body: true } } } },
    },
  });

  let sent = 0;
  let failed = 0;
  for (const clinic of clinics) {
    const sub = clinic.subscription;
    const dentalOn = sub?.entitlements.some((e) => e.module === "DENTAL" && e.active);
    if (!sub || !dentalOn || !isSubscriptionUsable(sub.status, sub.currentPeriodEnd)) continue;

    const settings = clinic.smsSettings!;
    const windowEnd = new Date(now.getTime() + settings.reminderHoursBefore * HOUR_MS);
    const template = settings.reminderTemplate?.body ?? DEFAULT_REMINDER_TEXT;

    const due = await db.appointment.findMany({
      where: {
        organizationId: clinic.id,
        status: "SCHEDULED",
        reminderSentAt: null,
        startsAt: { gt: now, lte: windowEnd },
        patient: { deletedAt: null },
      },
      include: { patient: true, doctor: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
      take: 200,
    });

    for (const appt of due) {
      const claim = await db.appointment.updateMany({
        where: { id: appt.id, reminderSentAt: null },
        data: { reminderSentAt: now },
      });
      if (claim.count === 0) continue;

      try {
        const body = renderMessage(template, {
          patientName: appt.patient.fullName,
          clinicName: clinic.name,
          appointment: { startsAt: appt.startsAt, doctorName: appt.doctor.user.name },
        });
        await sendSmsAndLog(db, {
          organizationId: clinic.id,
          phone: appt.patient.phone,
          body,
          kind: "REMINDER",
          patientId: appt.patientId,
          appointmentId: appt.id,
        });
        sent++;
      } catch (e) {
        failed++;
        if (e instanceof MessagingError && e.transient) {
          await db.appointment.update({ where: { id: appt.id }, data: { reminderSentAt: null } });
        }
      }
    }
  }
  return { sent, failed };
}

let started = false;

/** Starts the in-process 5-minute loop (called once from instrumentation.ts). */
export function startReminderWorker() {
  if (started) return;
  started = true;
  const tick = () =>
    runDueReminders()
      .then(({ sent, failed }) => {
        if (sent || failed) console.log(`[sms-reminders] gönderildi: ${sent}, başarısız: ${failed}`);
      })
      .catch((err) => console.error("[sms-reminders] çalışma hatası:", err));
  setTimeout(tick, 30_000);
  setInterval(tick, 5 * 60 * 1000);
}
