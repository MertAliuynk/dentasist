-- CreateEnum
CREATE TYPE "SupportMessageKind" AS ENUM ('MESSAGE', 'SYSTEM');

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "ref" TEXT,
ALTER COLUMN "organizationId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "attachmentsAllowed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "customerReadAt" TIMESTAMP(3),
ADD COLUMN     "errorContext" JSONB,
ADD COLUMN     "lastCustomerMsgAt" TIMESTAMP(3),
ADD COLUMN     "lastStaffMsgAt" TIMESTAMP(3),
ADD COLUMN     "staffReadAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SupportTicketMessage" ADD COLUMN     "kind" "SupportMessageKind" NOT NULL DEFAULT 'MESSAGE';

-- CreateTable
CREATE TABLE "SupportTicketAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportTicketAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicketAttachment_messageId_idx" ON "SupportTicketAttachment"("messageId");

-- CreateIndex
CREATE INDEX "ActivityLog_ref_idx" ON "ActivityLog"("ref");

-- CreateIndex
CREATE INDEX "SupportTicket_status_updatedAt_idx" ON "SupportTicket"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "SupportTicketAttachment" ADD CONSTRAINT "SupportTicketAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "SupportTicketMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Data: last message times from existing history, and treat everything
-- that already exists as read by both sides (no unread flood on deploy).
UPDATE "SupportTicket" t SET
  "lastCustomerMsgAt" = (SELECT max(m."createdAt") FROM "SupportTicketMessage" m WHERE m."ticketId" = t."id" AND m."authorUserId" IS NOT NULL),
  "lastStaffMsgAt"    = (SELECT max(m."createdAt") FROM "SupportTicketMessage" m WHERE m."ticketId" = t."id" AND m."authorPlatformUserId" IS NOT NULL),
  "customerReadAt"    = CURRENT_TIMESTAMP,
  "staffReadAt"       = CURRENT_TIMESTAMP;