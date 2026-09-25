-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "adminNote" TEXT;

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "path" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "input" JSONB,
    "ok" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "durationMs" INTEGER,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_createdAt_idx" ON "ActivityLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_organizationId_ok_createdAt_idx" ON "ActivityLog"("organizationId", "ok", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_ok_createdAt_idx" ON "ActivityLog"("ok", "createdAt");

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
