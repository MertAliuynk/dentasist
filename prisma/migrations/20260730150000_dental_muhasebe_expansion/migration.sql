-- CreateEnum
CREATE TYPE "SupportTicketStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- AlterEnum
ALTER TYPE "InstallmentStatus" ADD VALUE 'PARTIAL';

-- DropForeignKey
ALTER TABLE "CashRegisterEntry" DROP CONSTRAINT "CashRegisterEntry_installmentId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorFavoriteTreatmentType" DROP CONSTRAINT "DoctorFavoriteTreatmentType_doctorId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorFavoriteTreatmentType" DROP CONSTRAINT "DoctorFavoriteTreatmentType_treatmentTypeId_fkey";

-- DropIndex
DROP INDEX "CashRegisterEntry_installmentId_key";

-- AlterTable
ALTER TABLE "Installment" ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "anamnezRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "appointmentBufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "appointmentDurationMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "billingAddress" TEXT,
ADD COLUMN     "billingEmail" TEXT,
ADD COLUMN     "onamRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "smsRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "taxNumber" TEXT,
ADD COLUMN     "taxOffice" TEXT,
ADD COLUMN     "workingHours" JSONB;

-- CreateTable
CREATE TABLE "PatientCompanion" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientCompanion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentBlock" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "doctorId" TEXT,
    "roomId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppointmentBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFavoriteTreatmentType" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "treatmentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFavoriteTreatmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentAllocation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "installmentId" TEXT NOT NULL,
    "cashRegisterEntryId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallmentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" "SupportTicketStatus" NOT NULL DEFAULT 'OPEN',
    "createdIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorPlatformUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdIp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientCompanion_patientId_idx" ON "PatientCompanion"("patientId");

-- CreateIndex
CREATE INDEX "AppointmentBlock_organizationId_branchId_startsAt_idx" ON "AppointmentBlock"("organizationId", "branchId", "startsAt");

-- CreateIndex
CREATE INDEX "AppointmentBlock_doctorId_startsAt_idx" ON "AppointmentBlock"("doctorId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFavoriteTreatmentType_userId_treatmentTypeId_key" ON "UserFavoriteTreatmentType"("userId", "treatmentTypeId");

-- CreateIndex
CREATE INDEX "InstallmentAllocation_installmentId_idx" ON "InstallmentAllocation"("installmentId");

-- CreateIndex
CREATE INDEX "InstallmentAllocation_cashRegisterEntryId_idx" ON "InstallmentAllocation"("cashRegisterEntryId");

-- CreateIndex
CREATE INDEX "SupportTicket_organizationId_status_idx" ON "SupportTicket"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SupportTicketMessage_ticketId_idx" ON "SupportTicketMessage"("ticketId");

-- AddForeignKey
ALTER TABLE "PatientCompanion" ADD CONSTRAINT "PatientCompanion_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBlock" ADD CONSTRAINT "AppointmentBlock_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBlock" ADD CONSTRAINT "AppointmentBlock_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBlock" ADD CONSTRAINT "AppointmentBlock_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppointmentBlock" ADD CONSTRAINT "AppointmentBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavoriteTreatmentType" ADD CONSTRAINT "UserFavoriteTreatmentType_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFavoriteTreatmentType" ADD CONSTRAINT "UserFavoriteTreatmentType_treatmentTypeId_fkey" FOREIGN KEY ("treatmentTypeId") REFERENCES "TreatmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentAllocation" ADD CONSTRAINT "InstallmentAllocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentAllocation" ADD CONSTRAINT "InstallmentAllocation_installmentId_fkey" FOREIGN KEY ("installmentId") REFERENCES "Installment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentAllocation" ADD CONSTRAINT "InstallmentAllocation_cashRegisterEntryId_fkey" FOREIGN KEY ("cashRegisterEntryId") REFERENCES "CashRegisterEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicketMessage" ADD CONSTRAINT "SupportTicketMessage_authorPlatformUserId_fkey" FOREIGN KEY ("authorPlatformUserId") REFERENCES "PlatformUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: backfill new tables from the columns/tables we're about to
-- drop below, while both old and new shapes still exist side by side.
INSERT INTO "UserFavoriteTreatmentType" ("id", "userId", "treatmentTypeId", "createdAt")
SELECT gen_random_uuid()::text, d."userId", dftt."treatmentTypeId", dftt."createdAt"
FROM "DoctorFavoriteTreatmentType" dftt
JOIN "Doctor" d ON d.id = dftt."doctorId"
ON CONFLICT ("userId", "treatmentTypeId") DO NOTHING;

UPDATE "Installment" SET "paidAmount" = "amount" WHERE "status" = 'PAID';

-- Entries with deletedAt set were already reversed under the old model
-- (their linked installment was explicitly reset to UNPAID by the old
-- delete endpoint), so they must not resurface as live allocations here.
INSERT INTO "InstallmentAllocation" ("id", "organizationId", "installmentId", "cashRegisterEntryId", "amount", "createdAt")
SELECT gen_random_uuid()::text, p."organizationId", cre."installmentId", cre."id", cre."amount", cre."createdAt"
FROM "CashRegisterEntry" cre
JOIN "Installment" i ON i."id" = cre."installmentId"
JOIN "PaymentPlan" p ON p."id" = i."paymentPlanId"
WHERE cre."installmentId" IS NOT NULL AND cre."deletedAt" IS NULL;

-- DropTable (now that UserFavoriteTreatmentType has been backfilled)
DROP TABLE "DoctorFavoriteTreatmentType";

-- AlterTable (now that InstallmentAllocation has been backfilled)
ALTER TABLE "CashRegisterEntry" DROP COLUMN "installmentId";
