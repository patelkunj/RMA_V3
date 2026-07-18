import { app } from "../../src/app.js";
import prisma from "../../src/db/prisma.js";
import {
    processOutboxBatch,
    stopOutboxWorker,
} from "../../src/services/outbox.service.js";
import { stopSlaWorker } from "../../src/services/sla.service.js";
import { stopMaintenanceWorker } from "../../src/services/maintenance.service.js";
import { refreshUserSession } from "../../src/services/session.service.js";

let server;
let shuttingDown = false;
const barrierReleases = new Map();

const send = (message) => {
    if (process.connected) process.send(message);
};

const serializeError = (error) => ({
    name: error?.name || "Error",
    message: String(error?.message || error),
    stack: error?.stack,
});

const waitAtCommandBarrier = (id) => new Promise((resolve) => {
    barrierReleases.set(id, resolve);
    send({ type: "command-barrier", id });
});

const shutdown = async (signal = "test") => {
    if (shuttingDown) return;
    shuttingDown = true;
    stopOutboxWorker();
    stopSlaWorker();
    stopMaintenanceWorker();

    if (server?.listening) {
        await new Promise((resolve) => server.close(resolve));
    }
    await prisma.$disconnect().catch(() => undefined);
    send({ type: "stopped", signal });
    process.exit(0);
};

const handleCommand = async (message) => {
    if (!message || message.type !== "command") return;

    try {
        let result;
        if (message.command === "process-outbox") {
            result = await processOutboxBatch({
                limit: Number(message.limit) || 20,
                beforeClaim: message.barrier ? () => waitAtCommandBarrier(message.id) : undefined,
            });
        } else if (message.command === "refresh-session") {
            result = await refreshUserSession(message.refreshToken, {
                beforeClaim: message.barrier ? () => waitAtCommandBarrier(message.id) : undefined,
            });
        } else if (message.command === "ping") {
            result = { ok: true };
        } else {
            throw new Error(`Unknown fixture command: ${message.command}`);
        }
        barrierReleases.delete(message.id);
        send({ type: "command-result", id: message.id, result });
    } catch (error) {
        barrierReleases.delete(message.id);
        send({ type: "command-result", id: message.id, error: serializeError(error) });
    }
};

const start = async () => {
    await prisma.$connect();
    const requestedPort = Number(process.env.PORT || 0);
    server = app.listen(requestedPort, "127.0.0.1", () => {
        const address = server.address();
        send({
            type: "ready",
            instance: process.env.TEST_INSTANCE_NAME || String(process.pid),
            port: typeof address === "object" && address ? address.port : requestedPort,
        });
    });
    server.requestTimeout = Number(process.env.HTTP_REQUEST_TIMEOUT_MS || 10_000);
    server.headersTimeout = Number(process.env.HTTP_HEADERS_TIMEOUT_MS || 5_000);
    server.keepAliveTimeout = Number(process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS || 1_000);
};

// `node --test` discovers every JavaScript file below `test/`. Only boot the
// fixture when it was explicitly forked with an IPC channel by the integration
// test; direct discovery should be a harmless no-op.
if (process.env.MULTI_INSTANCE_FIXTURE === "true" && typeof process.send === "function") {
    process.on("message", (message) => {
        if (message?.type === "barrier-release") {
            const release = barrierReleases.get(message.id);
            if (release) {
                barrierReleases.delete(message.id);
                release();
            }
            return;
        }
        handleCommand(message).catch((error) => {
            send({ type: "fatal", error: serializeError(error) });
        });
    });
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));

    start().catch(async (error) => {
        send({ type: "fatal", error: serializeError(error) });
        await prisma.$disconnect().catch(() => undefined);
        process.exit(1);
    });
}
