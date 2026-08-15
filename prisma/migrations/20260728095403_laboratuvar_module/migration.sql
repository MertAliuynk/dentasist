-- CreateEnum
CREATE TYPE "LabTreatmentStatus" AS ENUM ('DEVAM_EDIYOR', 'TAMAMLANDI');

-- CreateEnum
CREATE TYPE "LabCashEntryType" AS ENUM ('GELIR', 'GIDER');

-- AlterEnum
ALTER TYPE "GlobalRole" ADD VALUE 'TEKNISYEN';

-- AlterEnum
ALTER TYPE "ModuleKey" ADD VALUE 'LABORATUVAR';

-- AlterTable
ALTER TABLE "Doctor" ADD COLUMN     "klinikId" TEXT;

-- CreateTable
CREATE TABLE "Klinik" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Klinik_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabPatient" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "klinikId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTreatmentType" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTreatmentType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothColor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ToothColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabStageCatalog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabStageCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTreatment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "labPatientId" TEXT NOT NULL,
    "labTreatmentTypeId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "toothColorId" TEXT,
    "price" INTEGER NOT NULL,
    "status" "LabTreatmentStatus" NOT NULL DEFAULT 'DEVAM_EDIYOR',
    "finishedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LabTreatment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabTreatmentStage" (
    "id" TEXT NOT NULL,
    "labTreatmentId" TEXT NOT NULL,
    "stageCatalogId" TEXT NOT NULL,
    "addedByUserId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabTreatmentStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabNotification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "labTreatmentId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "labTreatmentId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabExpenseCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCashEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "type" "LabCashEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "categoryId" TEXT,
    "description" TEXT,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCashEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Klinik_organizationId_branchId_idx" ON "Klinik"("organizationId", "branchId");

-- CreateIndex
CREATE INDEX "LabPatient_organizationId_klinikId_idx" ON "LabPatient"("organizationId", "klinikId");

-- CreateIndex
CREATE INDEX "LabPatient_organizationId_doctorId_idx" ON "LabPatient"("organizationId", "doctorId");

-- CreateIndex
CREATE UNIQUE INDEX "LabTreatmentType_organizationId_name_key" ON "LabTreatmentType"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ToothColor_organizationId_name_key" ON "ToothColor"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "LabStageCatalog_organizationId_name_key" ON "LabStageCatalog"("organizationId", "name");

-- CreateIndex
CREATE INDEX "LabTreatment_organizationId_doctorId_status_idx" ON "LabTreatment"("organizationId", "doctorId", "status");

-- CreateIndex
CREATE INDEX "LabTreatment_organizationId_labPatientId_idx" ON "LabTreatment"("organizationId", "labPatientId");

-- CreateIndex
CREATE INDEX "LabTreatmentStage_labTreatmentId_idx" ON "LabTreatmentStage"("labTreatmentId");

-- CreateIndex
CREATE INDEX "LabNotification_recipientUserId_readAt_idx" ON "LabNotification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "LabFeedback_organizationId_createdAt_idx" ON "LabFeedback"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabExpenseCategory_organizationId_name_key" ON "LabExpenseCategory"("organizationId", "name");

-- CreateIndex
CREATE INDEX "LabCashEntry_organizationId_branchId_entryDate_idx" ON "LabCashEntry"("organizationId", "branchId", "entryDate");

-- CreateIndex
CREATE INDEX "Doctor_klinikId_idx" ON "Doctor"("klinikId");

-- AddForeignKey
ALTER TABLE "Doctor" ADD CONSTRAINT "Doctor_klinikId_fkey" FOREIGN KEY ("klinikId") REFERENCES "Klinik"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Klinik" ADD CONSTRAINT "Klinik_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Klinik" ADD CONSTRAINT "Klinik_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPatient" ADD CONSTRAINT "LabPatient_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPatient" ADD CONSTRAINT "LabPatient_klinikId_fkey" FOREIGN KEY ("klinikId") REFERENCES "Klinik"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPatient" ADD CONSTRAINT "LabPatient_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatmentType" ADD CONSTRAINT "LabTreatmentType_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothColor" ADD CONSTRAINT "ToothColor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabStageCatalog" ADD CONSTRAINT "LabStageCatalog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatment" ADD CONSTRAINT "LabTreatment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatment" ADD CONSTRAINT "LabTreatment_labPatientId_fkey" FOREIGN KEY ("labPatientId") REFERENCES "LabPatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatment" ADD CONSTRAINT "LabTreatment_labTreatmentTypeId_fkey" FOREIGN KEY ("labTreatmentTypeId") REFERENCES "LabTreatmentType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatment" ADD CONSTRAINT "LabTreatment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatment" ADD CONSTRAINT "LabTreatment_toothColorId_fkey" FOREIGN KEY ("toothColorId") REFERENCES "ToothColor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatmentStage" ADD CONSTRAINT "LabTreatmentStage_labTreatmentId_fkey" FOREIGN KEY ("labTreatmentId") REFERENCES "LabTreatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatmentStage" ADD CONSTRAINT "LabTreatmentStage_stageCatalogId_fkey" FOREIGN KEY ("stageCatalogId") REFERENCES "LabStageCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabTreatmentStage" ADD CONSTRAINT "LabTreatmentStage_addedByUserId_fkey" FOREIGN KEY ("addedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabNotification" ADD CONSTRAINT "LabNotification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabNotification" ADD CONSTRAINT "LabNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabNotification" ADD CONSTRAINT "LabNotification_labTreatmentId_fkey" FOREIGN KEY ("labTreatmentId") REFERENCES "LabTreatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabFeedback" ADD CONSTRAINT "LabFeedback_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabFeedback" ADD CONSTRAINT "LabFeedback_labTreatmentId_fkey" FOREIGN KEY ("labTreatmentId") REFERENCES "LabTreatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabFeedback" ADD CONSTRAINT "LabFeedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabExpenseCategory" ADD CONSTRAINT "LabExpenseCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCashEntry" ADD CONSTRAINT "LabCashEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCashEntry" ADD CONSTRAINT "LabCashEntry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCashEntry" ADD CONSTRAINT "LabCashEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "LabExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
