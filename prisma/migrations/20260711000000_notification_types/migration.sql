-- Normalize existing values before converting free-form text columns to enums.
UPDATE "Notification"
SET "recipientType" = UPPER("recipientType"),
    "referenceType" = UPPER("referenceType");

CREATE TYPE "NotificationRecipientType" AS ENUM ('USER', 'CUSTOMER');
CREATE TYPE "NotificationReferenceType" AS ENUM ('CHAT', 'REPAIR_JOB');

DROP INDEX "Notification_recipientType_recipientId_isRead_idx";
DROP INDEX "Notification_referenceType_referenceId_idx";

ALTER TABLE "Notification"
ALTER COLUMN "recipientType" TYPE "NotificationRecipientType"
USING ("recipientType"::"NotificationRecipientType"),
ALTER COLUMN "referenceType" TYPE "NotificationReferenceType"
USING ("referenceType"::"NotificationReferenceType");

CREATE INDEX "Notification_recipientType_recipientId_isRead_idx"
ON "Notification"("recipientType", "recipientId", "isRead");

CREATE INDEX "Notification_organizationId_createdDate_idx"
ON "Notification"("organizationId", "createdDate");

CREATE INDEX "Notification_referenceType_referenceId_idx"
ON "Notification"("referenceType", "referenceId");

ALTER TABLE "Notification"
DROP CONSTRAINT "Notification_organizationId_fkey",
ADD CONSTRAINT "Notification_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
