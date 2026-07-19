import prisma from "../db/prisma.js";

const liveness = () => ({
    status: "ok",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
});

const readiness = async () => {
    const startedAt = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return {
        status: "ready",
        checks: {
            database: {
                status: "ok",
                latencyMs: Date.now() - startedAt,
            },
        },
        timestamp: new Date().toISOString(),
    };
};

export { liveness, readiness };
