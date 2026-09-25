-- CreateEnum
CREATE TYPE "SmsProvider" AS ENUM ('NETGSM');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('MANUAL', 'REMINDER', 'TEST');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'FAILED', 'OPENED');

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SmsSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" "SmsProvider" NOT NULL DEFAULT 'NETGSM',
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "msgheader" TEXT NOT NULL,
    "reminderHoursBefore" INTEGER NOT NULL DEFAULT 24,
    "reminderTemplateId" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "kind" "MessageKind" NOT NULL,
    "status" "MessageStatus" NOT NULL,
    "patientId" TEXT,
    "appointmentId" TEXT,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "providerRef" TEXT,
    "errorMessage" TEXT,
    "sentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsSettings_organizationId_key" ON "SmsSettings"("organizationId");

-- CreateIndex
CREATE INDEX "MessageLog_organizationId_createdAt_idx" ON "MessageLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageLog_appointmentId_idx" ON "MessageLog"("appointmentId");

-- AddForeignKey
ALTER TABLE "SmsSettings" ADD CONSTRAINT "SmsSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsSettings" ADD CONSTRAINT "SmsSettings_reminderTemplateId_fkey" FOREIGN KEY ("reminderTemplateId") REFERENCES "MessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLog" ADD CONSTRAINT "MessageLog_sentByUserId_fkey" FOREIGN KEY ("sentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
