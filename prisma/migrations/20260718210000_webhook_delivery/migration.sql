CREATE TABLE "WebhookDelivery" (
    "id" BIGSERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "outboxEventId" BIGINT NOT NULL,
    "webhookEndpointId" INTEGER NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "responseStatus" INTEGER,
    "lastError" TEXT,
    "createdDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WebhookDelivery_outboxEventId_webhookEndpointId_key"
ON "WebhookDelivery"("outboxEventId", "webhookEndpointId");

CREATE INDEX "WebhookDelivery_status_availableAt_idx"
ON "WebhookDelivery"("status", "availableAt");

CREATE INDEX "WebhookDelivery_organizationId_createdDate_idx"
ON "WebhookDelivery"("organizationId", "createdDate");

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_outboxEventId_fkey"
FOREIGN KEY ("outboxEventId") REFERENCES "OutboxEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebhookDelivery"
ADD CONSTRAINT "WebhookDelivery_webhookEndpointId_fkey"
FOREIGN KEY ("webhookEndpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
