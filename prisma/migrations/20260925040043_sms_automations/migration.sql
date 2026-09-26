-- SMS automations: replaces the single "randevu hatırlatma" setting
-- (Organization.smsRemindersEnabled + SmsSettings.reminderHoursBefore/
-- reminderTemplateId + Appointment.reminderSentAt) with any number of
-- SmsAutomation rules. Existing settings are carried over before the old
-- columns are dropped.

-- CreateEnum
CREATE TYPE "SmsAutomationTrigger" AS ENUM ('APPOINTMENT_BEFORE', 'APPOINTMENT_CREATED', 'APPOINTMENT_AFTER', 'NO_SHOW', 'BIRTHDAY', 'RECALL');

-- CreateEnum
CREATE TYPE "SmsTimingMode" AS ENUM ('RELATIVE', 'FIXED_TIME');

-- AlterEnum
ALTER TYPE "MessageKind" ADD VALUE 'AUTOMATION';

-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'SKIPPED';

-- AlterTable
ALTER TABLE "MessageLog" ADD COLUMN     "automationId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "smsOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SmsAutomation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "SmsAutomationTrigger" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "templateId" TEXT,
    "timingMode" "SmsTimingMode" NOT NULL DEFAULT 'RELATIVE',
    "offsetMinutes" INTEGER NOT NULL DEFAULT 0,
    "dayOffset" INTEGER NOT NULL DEFAULT 0,
    "sendTime" TEXT,
    "recallDays" INTEGER,
    "activeSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsDelivery" (
    "id" TEXT NOT NULL,
    "automationId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsAutomation_organizationId_enabled_idx" ON "SmsAutomation"("organizationId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "SmsDelivery_automationId_dedupeKey_key" ON "SmsDelivery"("automationId", "dedupeKey");

-- CreateIndex
CREATE INDEX "MessageLog_automationId_createdAt_idx" ON "MessageLog"("automationId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsAutomation" ADD CONSTRAINT "SmsAutomation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsAutomation" ADD CONSTRAINT "SmsAutomation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsDelivery" ADD CONSTRAINT "SmsDelivery_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "SmsAutomation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "SmsAutomation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data: every connected clinic's old reminder setting becomes a rule
-- (enabled only if reminders were on).
INSERT INTO "SmsAutomation" ("id", "organizationId", "name", "trigger", "enabled", "templateId", "timingMode", "offsetMinutes", "activeSince", "updatedAt")
SELECT 'mig_' || s."id", s."organizationId", 'Randevu Hatırlatma', 'APPOINTMENT_BEFORE', o."smsRemindersEnabled",
       s."reminderTemplateId", 'RELATIVE', s."reminderHoursBefore" * 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "SmsSettings" s
JOIN "Organization" o ON o."id" = s."organizationId";

-- Data: reminders already sent under the old scheme count as delivered for
-- the migrated rule, so nobody gets a second one. Key format must match
-- appointmentKey() in src/server/sms/automations.ts: "<id>@<startsAt ms>".
INSERT INTO "SmsDelivery" ("id", "automationId", "dedupeKey")
SELECT 'mig_' || a."id", 'mig_' || s."id",
       a."id" || '@' || (EXTRACT(EPOCH FROM a."startsAt") * 1000)::bigint
FROM "Appointment" a
JOIN "SmsSettings" s ON s."organizationId" = a."organizationId"
WHERE a."reminderSentAt" IS NOT NULL;

-- Old single-reminder columns.
ALTER TABLE "SmsSettings" DROP CONSTRAINT "SmsSettings_reminderTemplateId_fkey";
ALTER TABLE "SmsSettings" DROP COLUMN "reminderHoursBefore",
DROP COLUMN "reminderTemplateId";
ALTER TABLE "Appointment" DROP COLUMN "reminderSentAt";
ALTER TABLE "Organization" DROP COLUMN "smsRemindersEnabled";
