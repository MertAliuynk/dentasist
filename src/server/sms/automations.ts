import { Prisma, type SmsAutomation } from "@prisma/client";
import { db } from "@/server/db";
import { isSubscriptionUsable } from "@/lib/subscription-access";
import { normalizeTrMobile } from "@/lib/phone";
import { renderMessage } from "@/lib/message-render";
import { TRIGGER_META } from "@/lib/sms-automation";
import { addDays, trAt, trDay, trParts, type TrDay } from "@/lib/tr-time";
import { MessagingError, logMessage, sendSmsAndLog } from "@/server/sms/messaging";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
// Safety net against a misconfigured rule texting the whole patient list.
const MAX_SENDS_PER_ORG_PER_RUN = 300;

type Rule = SmsAutomation & { template: { body: string } | null };
type Org = { id: string; name: string; phone: string | null };

const PATIENT_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  birthDate: true,
  smsOptOut: true,
  branch: { select: { name: true, phone: true } },
} satisfies Prisma.PatientSelect;
type CandPatient = Prisma.PatientGetPayload<{ select: typeof PATIENT_SELECT }>;

export type Candidate = {
  dedupeKey: string;
  /** When it should go out. */
  sendAt: Date;
  /** Past this it's stale and silently dropped (e.g. the appointment started). */
  notAfter: Date;
  patient: CandPatient;
  appointment: { id: string; startsAt: Date; createdAt: Date; doctorName: string } | null;
};

/** Must match the key format written by the sms_automations migration. */
export const appointmentKey = (a: { id: string; startsAt: Date }) => `${a.id}@${a.startsAt.getTime()}`;

/** Non-urgent "after" messages don't go out at night — pushed to 09:00. */
function quietShift(d: Date): Date {
  const { hh } = trParts(d);
  if (hh >= 9 && hh < 21) return d;
  const day = trDay(d);
  return trAt(hh < 9 ? day : addDays(day, 1), "09:00");
}

const APPT_INCLUDE = {
  patient: { select: PATIENT_SELECT },
  doctor: { select: { user: { select: { name: true } } } },
} satisfies Prisma.AppointmentInclude;
type ApptRow = Prisma.AppointmentGetPayload<{ include: typeof APPT_INCLUDE }>;

function fromAppt(a: ApptRow, key: string, sendAt: Date, notAfter: Date): Candidate {
  return {
    dedupeKey: key,
    sendAt,
    notAfter,
    patient: a.patient,
    appointment: { id: a.id, startsAt: a.startsAt, createdAt: a.createdAt, doctorName: a.doctor.user.name },
  };
}

/**
 * Everything this rule would send whose window [sendAt, notAfter] touches
 * [from, to] — `from = to = now` for the live run, `[now, now+48h]` for the
 * "Planlanan Gönderimler" preview.
 */
export async function collectCandidates(rule: Rule, orgId: string, from: Date, to: Date): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const sendTime = rule.sendTime ?? "09:00";
  const baseWhere = { organizationId: orgId, patient: { deletedAt: null } };

  switch (rule.trigger) {
    case "APPOINTMENT_BEFORE": {
      const lead = rule.timingMode === "RELATIVE" ? rule.offsetMinutes * MIN : (rule.dayOffset + 1) * DAY;
      const appts = await db.appointment.findMany({
        where: { ...baseWhere, status: "SCHEDULED", startsAt: { gt: from, lte: new Date(to.getTime() + lead) } },
        include: APPT_INCLUDE,
      });
      for (const a of appts) {
        const sendAt =
          rule.timingMode === "RELATIVE"
            ? new Date(a.startsAt.getTime() - rule.offsetMinutes * MIN)
            : trAt(addDays(trDay(a.startsAt), -rule.dayOffset), sendTime);
        if (sendAt >= a.startsAt) continue; // e.g. "same day 18:00" for a 10:00 appointment
        out.push(fromAppt(a, appointmentKey(a), sendAt, a.startsAt));
      }
      break;
    }

    case "APPOINTMENT_CREATED": {
      const grace = 6 * HOUR;
      const appts = await db.appointment.findMany({
        where: {
          ...baseWhere,
          status: "SCHEDULED",
          startsAt: { gt: from },
          createdAt: {
            gte: new Date(Math.max(rule.activeSince.getTime(), from.getTime() - grace - rule.offsetMinutes * MIN)),
            lte: to,
          },
        },
        include: APPT_INCLUDE,
      });
      for (const a of appts) {
        const sendAt = new Date(a.createdAt.getTime() + rule.offsetMinutes * MIN);
        const notAfter = new Date(Math.min(sendAt.getTime() + grace, a.startsAt.getTime()));
        out.push(fromAppt(a, a.id, sendAt, notAfter));
      }
      break;
    }

    case "APPOINTMENT_AFTER":
    case "NO_SHOW": {
      const noShow = rule.trigger === "NO_SHOW";
      const grace = noShow ? DAY : 12 * HOUR;
      const lookback =
        rule.timingMode === "RELATIVE" ? rule.offsetMinutes * MIN + grace + 12 * HOUR : (rule.dayOffset + 2) * DAY;
      const appts = await db.appointment.findMany({
        where: {
          ...baseWhere,
          status: noShow ? "NO_SHOW" : { in: ["ARRIVED", "COMPLETED"] },
          startsAt: { gte: new Date(from.getTime() - lookback), lte: to },
        },
        include: APPT_INCLUDE,
      });
      for (const a of appts) {
        const base = noShow ? a.startsAt : a.endsAt;
        const sendAt =
          rule.timingMode === "RELATIVE"
            ? quietShift(new Date(base.getTime() + rule.offsetMinutes * MIN))
            : trAt(addDays(trDay(a.startsAt), rule.dayOffset), sendTime);
        if (sendAt < base) continue; // fixed time earlier than the visit itself
        out.push(fromAppt(a, a.id, sendAt, new Date(sendAt.getTime() + grace)));
      }
      break;
    }

    case "BIRTHDAY": {
      const days: TrDay[] = [];
      for (let d = trDay(from), end = trDay(to), i = 0; i < 4; i++, d = addDays(d, 1)) {
        days.push(d);
        if (d.y === end.y && d.m === end.m && d.d === end.d) break;
      }
      for (const day of days) {
        const mmdd = `${String(day.m).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;
        const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        const keys = mmdd === "02-28" && !isLeap(day.y) ? [mmdd, "02-29"] : [mmdd];
        const ids = await db.$queryRaw<{ id: string }[]>`
          SELECT "id" FROM "Patient"
          WHERE "organizationId" = ${orgId} AND "deletedAt" IS NULL AND "birthDate" IS NOT NULL
            AND to_char("birthDate", 'MM-DD') = ANY(${keys})`;
        if (ids.length === 0) continue;
        const patients = await db.patient.findMany({ where: { id: { in: ids.map((r) => r.id) } }, select: PATIENT_SELECT });
        const sendAt = trAt(day, sendTime);
        const endOfDay = trAt(day, "22:00");
        const notAfter = endOfDay > sendAt ? endOfDay : new Date(sendAt.getTime() + HOUR);
        for (const p of patients) {
          out.push({ dedupeKey: `${p.id}:${day.y}`, sendAt, notAfter, patient: p, appointment: null });
        }
      }
      break;
    }

    case "RECALL": {
      const n = rule.recallDays ?? 180;
      const grace = 3 * DAY;
      const lastVisits = await db.appointment.groupBy({
        by: ["patientId"],
        where: { organizationId: orgId, status: { in: ["ARRIVED", "COMPLETED"] }, patient: { deletedAt: null } },
        _max: { startsAt: true },
        having: {
          startsAt: {
            _max: {
              gte: new Date(from.getTime() - grace - (n + 1) * DAY),
              lte: new Date(to.getTime() - (n - 1) * DAY),
            },
          },
        },
      });
      if (lastVisits.length === 0) break;
      const withFuture = await db.appointment.findMany({
        where: {
          organizationId: orgId,
          patientId: { in: lastVisits.map((v) => v.patientId) },
          status: "SCHEDULED",
          startsAt: { gt: from },
        },
        select: { patientId: true },
        distinct: ["patientId"],
      });
      const skip = new Set(withFuture.map((w) => w.patientId));
      const patients = await db.patient.findMany({
        where: { id: { in: lastVisits.filter((v) => !skip.has(v.patientId)).map((v) => v.patientId) } },
        select: PATIENT_SELECT,
      });
      const byId = new Map(patients.map((p) => [p.id, p]));
      for (const v of lastVisits) {
        const p = byId.get(v.patientId);
        const last = v._max.startsAt;
        if (!p || !last) continue;
        const lastDay = trDay(last);
        const sendAt = trAt(addDays(lastDay, n), sendTime);
        out.push({
          dedupeKey: `${p.id}:${lastDay.y}-${lastDay.m}-${lastDay.d}`,
          sendAt,
          notAfter: new Date(sendAt.getTime() + grace),
          patient: p,
          appointment: null,
        });
      }
      break;
    }
  }

  return out.filter((c) => c.sendAt <= to && c.notAfter >= from);
}

/** A rule turned on (or re-timed) at T doesn't send for events it "missed" before T. */
function activeFor(rule: Rule, c: Candidate) {
  return c.sendAt >= rule.activeSince || (!!c.appointment && c.appointment.createdAt >= rule.activeSince);
}

async function undelivered(rule: Rule, cands: Candidate[]) {
  if (cands.length === 0) return cands;
  const done = await db.smsDelivery.findMany({
    where: { automationId: rule.id, dedupeKey: { in: cands.map((c) => c.dedupeKey) } },
    select: { dedupeKey: true },
  });
  const doneKeys = new Set(done.map((d) => d.dedupeKey));
  return cands.filter((c) => !doneKeys.has(c.dedupeKey));
}

function textFor(rule: Rule) {
  return rule.template?.body ?? TRIGGER_META[rule.trigger].defaultText;
}

function renderFor(rule: Rule, org: Org, c: Candidate): { text: string; error: null } | { text: null; error: string } {
  try {
    return {
      text: renderMessage(textFor(rule), {
        patient: c.patient,
        clinic: { name: org.name, phone: org.phone },
        branch: c.patient.branch,
        appointment: c.appointment,
      }),
      error: null,
    };
  } catch (e) {
    return { text: null, error: (e as Error).message };
  }
}

/** Why a candidate won't actually get an SMS (shown in the plan, logged as SKIPPED). */
function skipReason(c: Candidate): string | null {
  if (c.patient.smsOptOut) return "Hasta SMS almak istemiyor";
  if (!normalizeTrMobile(c.patient.phone)) return "Geçerli cep telefonu yok";
  return null;
}

async function loadActiveOrgs(orgId?: string) {
  const orgs = await db.organization.findMany({
    where: {
      ...(orgId ? { id: orgId } : {}),
      smsSettings: { isNot: null },
      smsAutomations: { some: { enabled: true } },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      subscription: { select: { status: true, currentPeriodEnd: true, entitlements: true } },
      smsAutomations: { where: { enabled: true }, include: { template: { select: { body: true } } } },
    },
  });
  return orgs.filter((o) => {
    const sub = o.subscription;
    const dentalOn = sub?.entitlements.some((e) => e.module === "DENTAL" && e.active);
    return !!sub && !!dentalOn && isSubscriptionUsable(sub.status, sub.currentPeriodEnd);
  });
}

/**
 * One pass of the automation engine. Exactly-once per (rule, dedupeKey):
 * the SmsDelivery row is inserted before sending, so overlapping runs
 * can't double-send. A transient provider failure deletes it again so the
 * next run retries; anything else (bad credentials, opt-out, bad number)
 * stays recorded in Gönderim Geçmişi instead of repeating every 5 minutes.
 */
export async function runAutomations(now = new Date()) {
  const stats = { sent: 0, failed: 0, skipped: 0 };
  for (const org of await loadActiveOrgs()) {
    let budget = MAX_SENDS_PER_ORG_PER_RUN;
    for (const rule of org.smsAutomations) {
      const due = await undelivered(rule, (await collectCandidates(rule, org.id, now, now)).filter((c) => activeFor(rule, c)));
      for (const c of due) {
        if (budget-- <= 0) break;
        try {
          await db.smsDelivery.create({ data: { automationId: rule.id, dedupeKey: c.dedupeKey } });
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue; // another run got it
          throw e;
        }

        const base = {
          organizationId: org.id,
          phone: c.patient.phone,
          kind: "AUTOMATION" as const,
          patientId: c.patient.id,
          appointmentId: c.appointment?.id,
          automationId: rule.id,
        };
        const rendered = renderFor(rule, org, c);
        const reason = skipReason(c) ?? rendered.error;
        if (reason || !rendered.text) {
          await logMessage(db, { ...base, channel: "SMS", status: "SKIPPED", body: rendered.text ?? textFor(rule), errorMessage: reason ?? "Boş mesaj" });
          stats.skipped++;
          continue;
        }
        try {
          await sendSmsAndLog(db, { ...base, body: rendered.text });
          stats.sent++;
        } catch (e) {
          stats.failed++;
          if (e instanceof MessagingError && e.transient) {
            await db.smsDelivery.deleteMany({ where: { automationId: rule.id, dedupeKey: c.dedupeKey } });
          }
        }
      }
    }
  }
  return stats;
}

export type PlannedSend = {
  automationId: string;
  ruleName: string;
  sendAt: Date;
  due: boolean;
  patient: { id: string; fullName: string; phone: string };
  appointment: { startsAt: Date; doctorName: string } | null;
  text: string | null;
  warning: string | null;
};

/** Dry run for the "Planlanan Gönderimler" list — sends nothing. */
export async function planAutomations(orgId: string, hours: number, now = new Date()): Promise<PlannedSend[]> {
  const [org] = await loadActiveOrgs(orgId);
  if (!org) return [];
  const to = new Date(now.getTime() + hours * HOUR);
  const plan: PlannedSend[] = [];
  for (const rule of org.smsAutomations) {
    const cands = await undelivered(rule, (await collectCandidates(rule, org.id, now, to)).filter((c) => activeFor(rule, c)));
    for (const c of cands) {
      const rendered = renderFor(rule, org, c);
      plan.push({
        automationId: rule.id,
        ruleName: rule.name,
        sendAt: c.sendAt < now ? now : c.sendAt,
        due: c.sendAt <= now,
        patient: { id: c.patient.id, fullName: c.patient.fullName, phone: c.patient.phone },
        appointment: c.appointment ? { startsAt: c.appointment.startsAt, doctorName: c.appointment.doctorName } : null,
        text: rendered.text,
        warning: skipReason(c) ?? rendered.error,
      });
    }
  }
  return plan.sort((a, b) => a.sendAt.getTime() - b.sendAt.getTime()).slice(0, 500);
}

let started = false;

/** Starts the in-process 5-minute loop (called once from instrumentation.ts). */
export function startAutomationWorker() {
  if (started) return;
  started = true;
  const tick = () =>
    runAutomations()
      .then(({ sent, failed, skipped }) => {
        if (sent || failed || skipped) console.log(`[sms-otomasyon] gönderildi: ${sent}, başarısız: ${failed}, atlandı: ${skipped}`);
      })
      .catch((err) => console.error("[sms-otomasyon] çalışma hatası:", err));
  setTimeout(tick, 30_000);
  setInterval(tick, 5 * 60 * 1000);
}
