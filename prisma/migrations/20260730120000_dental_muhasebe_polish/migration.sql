-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "roomId" TEXT;

-- AlterTable
ALTER TABLE "CashRegisterEntry" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- Stage the enum's text value before dropping the column, so existing
-- TreatmentType rows can be backfilled into the new dynamic category table
-- instead of just losing their category outright.
ALTER TABLE "TreatmentType" ADD COLUMN "_old_category_name" TEXT;
UPDATE "TreatmentType" SET "_old_category_name" = "category"::TEXT;

-- AlterTable
ALTER TABLE "TreatmentType" DROP COLUMN "category",
ADD COLUMN     "categoryId" TEXT;

-- DropEnum
DROP TYPE "TreatmentCategory";

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentCategory" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreatmentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorFavoriteTreatmentType" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "treatmentTypeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorFavoriteTreatmentType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Room_organizationId_branchId_name_key" ON "Room"("organizationId", "branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentCategory_organizationId_name_key" ON "TreatmentCategory"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorFavoriteTreatmentType_doctorId_treatmentTypeId_key" ON "DoctorFavoriteTreatmentType"("doctorId", "treatmentTypeId");

-- Backfill: one TreatmentCategory row per distinct (org, old enum value)
-- pair actually in use, then point existing TreatmentType rows at it. Orgs
-- that had no categorized treatment types simply get none (matches the new
-- "admin creates categories from scratch" behavior).
INSERT INTO "TreatmentCategory" ("id", "organizationId", "name", "createdAt")
SELECT gen_random_uuid()::text, tt."organizationId", tt."_old_category_name", CURRENT_TIMESTAMP
FROM "TreatmentType" tt
WHERE tt."_old_category_name" IS NOT NULL
GROUP BY tt."organizationId", tt."_old_category_name";

UPDATE "TreatmentType" tt
SET "categoryId" = tc."id"
FROM "TreatmentCategory" tc
WHERE tc."organizationId" = tt."organizationId"
  AND tc."name" = tt."_old_category_name";

ALTER TABLE "TreatmentType" DROP COLUMN "_old_category_name";

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentCategory" ADD CONSTRAINT "TreatmentCategory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentType" ADD CONSTRAINT "TreatmentType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TreatmentCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorFavoriteTreatmentType" ADD CONSTRAINT "DoctorFavoriteTreatmentType_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorFavoriteTreatmentType" ADD CONSTRAINT "DoctorFavoriteTreatmentType_treatmentTypeId_fkey" FOREIGN KEY ("treatmentTypeId") REFERENCES "TreatmentType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
