import { createHmac } from "crypto";
import prisma from "../db/prisma.js";
import { logger } from "../utils/logger.js";
import { decryptSecret } from "../utils/encryption.js";

const enqueueOutbox = (db, {
    organizationId,
    eventType,
    aggregateType,
    aggregateId,
    payload,
}) => db.outboxEvent.create({
    data: {
        organizationId: organizationId ? Number(organizationId) : null,
        eventType,
        aggregateType,
        aggregateId: String(aggregateId),
        payload,
    },
});

const retryDate = (attempts, now = new Date()) => new Date(now.getTime() + Math.min(2 ** attempts, 60) * 60_000);

const ensureWebhookDeliveries = async (event, now) => {
    if (event.eventType.startsWith("email.") || !event.organizationId) return [];
    const endpoints = await prisma.webhookEndpoint.findMany({
        where: {
            organizationId: event.organizationId,
            isActive: true,
            OR: [{ events: { isEmpty: true } }, { events: { has: event.eventType } }],
        },
        select: { id: true },
    });
    if (endpoints.length) {
        await prisma.webhookDelivery.createMany({
            data: endpoints.map((endpoint) => ({
                organizationId: event.organizationId,
                outboxEventId: event.id,
                webhookEndpointId: endpoint.id,
                availableAt: now,
            })),
            skipDuplicates: true,
        });
    }
    return endpoints;
};

const deliverWebhook = async (event, delivery, fetchImpl, now) => {
    const claimed = await prisma.webhookDelivery.updateMany({
        where: {
            id: delivery.id,
            OR: [
                { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
                { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
            ],
        },
        data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
    });
    if (!claimed.count) return delivery.status === "SENT";

    const endpoint = delivery.webhookEndpoint;
    const body = JSON.stringify({
        id: String(event.id),
        type: event.eventType,
        createdAt: event.createdDate,
        data: event.payload,
    });

    try {
        const signature = createHmac("sha256", decryptSecret(endpoint.secretCiphertext)).update(body).digest("hex");
        const response = await fetchImpl(endpoint.url, {
                method: "POST",
                redirect: "error",
                headers: {
                    "content-type": "application/json",
                    "user-agent": "rma-webhook/1.0",
                    "x-rma-event": event.eventType,
                    "x-rma-signature": `sha256=${signature}`,
                },
                body,
                signal: AbortSignal.timeout(Number(process.env.WEBHOOK_TIMEOUT_MS || 10000)),
            });
        if (!response.ok) throw new Error(`Webhook returned HTTP ${response.status}.`);
        await prisma.$transaction([
            prisma.webhookDelivery.update({
                where: { id: delivery.id },
                data: { status: "SENT", processedAt: now, lockedAt: null, responseStatus: response.status, lastError: null },
            }),
            prisma.webhookEndpoint.update({
                where: { id: endpoint.id },
                data: { failureCount: 0, lastSuccessAt: now },
            }),
        ]);
        return true;
    } catch (error) {
        const attempts = delivery.attempts + 1;
        await prisma.$transaction([
            prisma.webhookDelivery.update({
                where: { id: delivery.id },
                data: {
                    status: "FAILED",
                    lockedAt: null,
                    responseStatus: null,
                    lastError: String(error?.message || error).slice(0, 1000),
                    availableAt: retryDate(attempts, now),
                },
            }),
            prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { failureCount: { increment: 1 } } }),
        ]);
        logger.warn("webhook_delivery_failed", { eventId: String(event.id), endpointId: endpoint.id, attempts, error });
        return false;
    }
};

const deliverWebhooks = async (event, { fetchImpl, now }) => {
    await ensureWebhookDeliveries(event, now);
    const deliveries = await prisma.webhookDelivery.findMany({
        where: {
            outboxEventId: event.id,
            OR: [
                { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
                { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
            ],
        },
        include: { webhookEndpoint: true },
        orderBy: { id: "asc" },
    });
    for (const delivery of deliveries) await deliverWebhook(event, delivery, fetchImpl, now);
    return prisma.webhookDelivery.findMany({ where: { outboxEventId: event.id, status: { not: "SENT" } } });
};

const deliverInternalEvent = async (event) => {
    if (event.eventType === "email.repair_status") {
        const { sendRepairJobStatusEmail } = await import("./email.service.js");
        await sendRepairJobStatusEmail(event.payload.repairJobId);
    }
};

// `beforeClaim` is an internal test seam that lets competing workers rendezvous
// after candidate selection without changing the production claim algorithm.
const processOutboxBatch = async ({
    limit = 20,
    fetchImpl = fetch,
    now: suppliedNow,
    beforeClaim,
} = {}) => {
    const now = suppliedNow ? new Date(suppliedNow) : new Date();
    const candidates = await prisma.outboxEvent.findMany({
        where: {
            OR: [
                { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
                { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
            ],
        },
        orderBy: { id: "asc" },
        take: limit,
    });
    if (beforeClaim) await beforeClaim(candidates);

    let processed = 0;
    for (const event of candidates) {
        const claimed = await prisma.outboxEvent.updateMany({
            where: {
                id: event.id,
                OR: [
                    { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
                    { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
                ],
            },
            data: { status: "PROCESSING", lockedAt: now, attempts: { increment: 1 } },
        });
        if (!claimed.count) continue;

        try {
            await deliverInternalEvent(event);
            const outstanding = await deliverWebhooks(event, { fetchImpl, now });
            if (outstanding.length) {
                const nextAttempt = outstanding.reduce((earliest, delivery) => delivery.availableAt < earliest ? delivery.availableAt : earliest, outstanding[0].availableAt);
                await prisma.outboxEvent.update({
                    where: { id: event.id },
                    data: { status: "FAILED", lockedAt: null, lastError: "One or more webhook deliveries failed.", availableAt: nextAttempt },
                });
                continue;
            }
            await prisma.outboxEvent.update({
                where: { id: event.id },
                data: { status: "SENT", processedAt: now, lockedAt: null, lastError: null },
            });
            processed += 1;
        } catch (error) {
            const attempts = event.attempts + 1;
            await prisma.outboxEvent.update({
                where: { id: event.id },
                data: {
                    status: "FAILED",
                    lockedAt: null,
                    lastError: String(error?.message || error).slice(0, 1000),
                    availableAt: retryDate(attempts, now),
                },
            });
            logger.warn("outbox_delivery_failed", { eventId: String(event.id), attempts, error });
        }
    }
    return { selected: candidates.length, processed };
};

let workerTimer;
const startOutboxWorker = () => {
    if (process.env.OUTBOX_WORKER_ENABLED === "false" || workerTimer) return;
    const intervalMs = Number(process.env.OUTBOX_POLL_INTERVAL_MS || 5000);
    workerTimer = setInterval(() => {
        processOutboxBatch().catch((error) => logger.error("outbox_worker_failed", { error }));
    }, intervalMs);
    workerTimer.unref?.();
};

const stopOutboxWorker = () => {
    if (workerTimer) clearInterval(workerTimer);
    workerTimer = undefined;
};

export { enqueueOutbox, processOutboxBatch, startOutboxWorker, stopOutboxWorker };
