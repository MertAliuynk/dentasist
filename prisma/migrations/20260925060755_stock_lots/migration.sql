-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('SATIN_ALMA', 'ACILIS', 'KULLANIM', 'HASTA_KULLANIMI', 'SAYIM', 'FIRE', 'SKT_IMHA', 'IADE');

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "invoiceNo" TEXT,
ADD COLUMN     "lotBreakdown" JSONB,
ADD COLUMN     "lotNo" TEXT,
ADD COLUMN     "reason" "StockMovementReason",
ADD COLUMN     "supplierId" TEXT,
ADD COLUMN     "unitCost" INTEGER;

-- AlterTable
ALTER TABLE "StockProduct" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "targetLevel" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "taxNumber" TEXT;

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL,
    "initialQuantity" INTEGER NOT NULL,
    "unitCost" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockLot_productId_expiryDate_idx" ON "StockLot"("productId", "expiryDate");

-- CreateIndex
CREATE INDEX "StockLot_organizationId_expiryDate_idx" ON "StockLot"("organizationId", "expiryDate");

-- CreateIndex
CREATE INDEX "StockMovement_organizationId_createdAt_idx" ON "StockMovement"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StockProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Data: every product's current stock becomes one opening lot (no expiry),
-- so sum(lots) = product.quantity from day one.
INSERT INTO "StockLot" ("id", "organizationId", "productId", "quantity", "initialQuantity", "unitCost", "receivedAt")
SELECT 'open_' || p."id", p."organizationId", p."id", p."quantity", p."quantity", p."unitPrice", p."createdAt"
FROM "StockProduct" p
WHERE p."quantity" > 0;

-- Data: reasons for movements recorded before reasons existed.
UPDATE "StockMovement" SET "reason" = CASE
  WHEN "type" = 'GIRIS' THEN 'SATIN_ALMA'::"StockMovementReason"
  WHEN "patientId" IS NOT NULL THEN 'HASTA_KULLANIMI'::"StockMovementReason"
  ELSE 'KULLANIM'::"StockMovementReason"
END
WHERE "reason" IS NULL;