-- CreateEnum
CREATE TYPE "PermissionEffect" AS ENUM ('GRANT', 'REVOKE');

-- CreateTable
CREATE TABLE "UserCapabilityOverride" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capability" TEXT NOT NULL,
    "effect" "PermissionEffect" NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCapabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserCapabilityOverride_organizationId_userId_idx" ON "UserCapabilityOverride"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCapabilityOverride_userId_capability_key" ON "UserCapabilityOverride"("userId", "capability");

-- AddForeignKey
ALTER TABLE "UserCapabilityOverride" ADD CONSTRAINT "UserCapabilityOverride_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCapabilityOverride" ADD CONSTRAINT "UserCapabilityOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
