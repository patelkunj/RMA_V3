import prisma from "../db/prisma.js";
import { logger } from "../utils/logger.js";

const processMaintenance = async () => {
    const now = new Date();
    const [expiredEstimates, overdueInvoices, idempotency, rateLimits, userSessions, customerSessions] = await prisma.$transaction([
        prisma.repairEstimate.updateMany({ where: { status: "SENT", expiresAt: { lt: now } }, data: { status: "EXPIRED" } }),
        prisma.invoice.updateMany({ where: { status: { in: ["ISSUED", "PARTIALLY_PAID"] }, dueAt: { lt: now } }, data: { status: "OVERDUE" } }),
        prisma.idempotencyRecord.deleteMany({ where: { expiresAt: { lt: now } } }),
        prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: now } } }),
        prisma.sessionManagement.updateMany({ where: { revokedAt: null, expiresAt: { lt: now } }, data: { revokedAt: now } }),
        prisma.customerSession.updateMany({ where: { revokedAt: null, expiresAt: { lt: now } }, data: { revokedAt: now } }),
    ]);
    return {
        expiredEstimates: expiredEstimates.count,
        overdueInvoices: overdueInvoices.count,
        deletedIdempotencyRecords: idempotency.count,
        deletedRateLimitBuckets: rateLimits.count,
        expiredUserSessions: userSessions.count,
        expiredCustomerSessions: customerSessions.count,
    };
};

let timer;
const startMaintenanceWorker = () => {
    if (process.env.MAINTENANCE_WORKER_ENABLED === "false" || timer) return;
    timer = setInterval(() => processMaintenance().catch((error) => logger.error("maintenance_worker_failed", { error })), Number(process.env.MAINTENANCE_POLL_INTERVAL_MS || 3600000));
    timer.unref?.();
};
const stopMaintenanceWorker = () => { if (timer) clearInterval(timer); timer = undefined; };

export { processMaintenance, startMaintenanceWorker, stopMaintenanceWorker };
