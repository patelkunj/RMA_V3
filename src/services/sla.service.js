import prisma from "../db/prisma.js";
import { logger } from "../utils/logger.js";

const processSlaBreaches = async (limit = 100) => {
    const jobs = await prisma.repairJob.findMany({
        where: {
            jobStatus: { in: ["CREATED", "RECEIVED", "IN_PROGRESS"] },
            slaDueAt: { lt: new Date() },
            slaBreachedAt: null,
        },
        select: { id: true, organizationId: true, slaDueAt: true },
        take: limit,
    });
    let processed = 0;
    for (const job of jobs) {
        const result = await prisma.repairJob.updateMany({
            where: { id: job.id, slaBreachedAt: null },
            data: { slaBreachedAt: new Date() },
        });
        if (!result.count) continue;
        await prisma.outboxEvent.create({
            data: {
                organizationId: job.organizationId,
                eventType: "repair_job.sla_breached",
                aggregateType: "RepairJob",
                aggregateId: String(job.id),
                payload: { repairJobId: job.id, slaDueAt: job.slaDueAt },
            },
        });
        processed += 1;
    }
    return { selected: jobs.length, processed };
};

let timer;
const startSlaWorker = () => {
    if (process.env.SLA_WORKER_ENABLED === "false" || timer) return;
    timer = setInterval(() => processSlaBreaches().catch((error) => logger.error("sla_worker_failed", { error })), Number(process.env.SLA_POLL_INTERVAL_MS || 60000));
    timer.unref?.();
};
const stopSlaWorker = () => { if (timer) clearInterval(timer); timer = undefined; };

export { processSlaBreaches, startSlaWorker, stopSlaWorker };
