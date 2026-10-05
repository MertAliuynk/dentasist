-- AlterTable
ALTER TABLE "CashRegisterEntry" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "exchangeRate" DECIMAL(12,4),
ADD COLUMN     "foreignAmount" INTEGER;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "costCurrency" TEXT NOT NULL DEFAULT 'TRY',
ADD COLUMN     "exchangeRate" DECIMAL(12,4),
ADD COLUMN     "foreignUnitCost" INTEGER;

-- Data fix: patient income used to be booked on the first branch; move it to the patient's branch.
UPDATE "CashRegisterEntry" e
SET "branchId" = p."branchId"
FROM "Patient" p
WHERE e."patientId" = p."id" AND e."branchId" <> p."branchId";
