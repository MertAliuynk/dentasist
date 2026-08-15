-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "completedTreatmentId" TEXT;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "anamnesisAnswers" JSONB;

-- CreateTable
CREATE TABLE "PatientConsentForm" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateTitle" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientConsentForm_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientConsentForm_organizationId_patientId_idx" ON "PatientConsentForm"("organizationId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_completedTreatmentId_key" ON "Appointment"("completedTreatmentId");

-- AddForeignKey
ALTER TABLE "PatientConsentForm" ADD CONSTRAINT "PatientConsentForm_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsentForm" ADD CONSTRAINT "PatientConsentForm_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConsentForm" ADD CONSTRAINT "PatientConsentForm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_completedTreatmentId_fkey" FOREIGN KEY ("completedTreatmentId") REFERENCES "Treatment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

