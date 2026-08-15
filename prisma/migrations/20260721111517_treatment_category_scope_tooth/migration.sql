-- CreateEnum
CREATE TYPE "TreatmentCategory" AS ENUM ('CERRAHI', 'ENDODONTI', 'ORTODONTI', 'PEDODONTI', 'PERIODONTOLOJI', 'PROTEZ', 'RADYOLOJI', 'RESTORATIF');

-- CreateEnum
CREATE TYPE "TreatmentScope" AS ENUM ('DIS_BAZLI', 'CENE_BAZLI');

-- CreateEnum
CREATE TYPE "Jaw" AS ENUM ('UST', 'ALT');

-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN     "jaw" "Jaw",
ADD COLUMN     "toothNumber" INTEGER;

-- AlterTable
ALTER TABLE "TreatmentType" ADD COLUMN     "category" "TreatmentCategory" NOT NULL DEFAULT 'RESTORATIF',
ADD COLUMN     "scope" "TreatmentScope" NOT NULL DEFAULT 'DIS_BAZLI';
