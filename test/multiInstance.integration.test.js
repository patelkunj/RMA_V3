import test from "node:test";
import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const fixturePath = fileURLToPath(new URL("./fixtures/multi-instance-server.js", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const integrationEnabled = process.env.RUN_DB_INTEGRATION_TESTS === "true";

const requireDedicatedTestDatabase = () => {
    const value = String(process.env.TEST_DATABASE_URL || "").trim();
    if (!value) throw new Error("TEST_DATABASE_URL is required for multi-instance integration tests.");

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
    }
    if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
        throw new Error("TEST_DATABASE_URL must use the postgres or postgresql protocol.");
    }

    const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
    if (!databaseName || !/(?:^|[_-])(?:test|integration)(?:[_-]|$)/i.test(databaseName)) {
        throw new Error("Multi-instance tests refuse databases whose name does not contain a test or integration segment.");
    }
    if (["postgres", "template0", "template1"].includes(databaseName.toLowerCase())) {
        throw new Error("Multi-instance tests refuse PostgreSQL administrative databases.");
    }

    return value;
};

const withTimeout = async (promise, timeoutMs, label) => {
    const controller = new AbortController();
    const timeout = delay(timeoutMs, undefined, { signal: controller.signal })
        .then(() => {
            throw new Error(`${label} timed out after ${timeoutMs}ms.`);
        });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        controller.abort();
    }
};

const spawnInstance = async (name, environment) => {
    const childEnvironment = {
        ...process.env,
        ...environment,
        TEST_INSTANCE_NAME: name,
        MULTI_INSTANCE_FIXTURE: "true",
        PORT: "0",
    };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const child = fork(fixturePath, [], {
        cwd: repositoryRoot,
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe", "ipc"],
    });
    const output = [];
    child.stdout.on("data", (chunk) => output.push(chunk.toString()));
    child.stderr.on("data", (chunk) => output.push(chunk.toString()));

    let commandSequence = 0;
    const pendingCommands = new Map();
    let resolveReady;
    let rejectReady;
    const ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    child.on("message", (message) => {
        if (message?.type === "ready") {
            resolveReady(message);
            return;
        }
        if (message?.type === "fatal") {
            rejectReady(new Error(`${name} failed: ${message.error?.message || "unknown error"}`));
            return;
        }
        if (message?.type === "command-barrier") {
            const pending = pendingCommands.get(message.id);
            pending?.resolveBarrier?.();
            return;
        }
        if (message?.type !== "command-result") return;
        const pending = pendingCommands.get(message.id);
        if (!pending) return;
        pendingCommands.delete(message.id);
        if (message.error) pending.reject(new Error(`${name}: ${message.error.message}`));
        else pending.resolve(message.result);
    });
    child.once("exit", (code, signal) => {
        const diagnostic = output.join("").slice(-4000);
        const error = new Error(`${name} exited before completion (code=${code}, signal=${signal}). ${diagnostic}`);
        rejectReady(error);
        for (const pending of pendingCommands.values()) pending.reject(error);
        pendingCommands.clear();
    });

    const readyMessage = await withTimeout(ready, 15_000, `${name} startup`).catch((error) => {
        child.kill("SIGTERM");
        throw error;
    });

    return {
        name,
        child,
        baseUrl: `http://127.0.0.1:${readyMessage.port}`,
        command(command, payload = {}) {
            const id = `${name}-${++commandSequence}`;
            const result = new Promise((resolve, reject) => {
                pendingCommands.set(id, { resolve, reject });
            });
            child.send({ type: "command", id, command, ...payload });
            return withTimeout(result, 15_000, `${name} ${command}`);
        },
        barrierCommand(command, payload = {}) {
            const id = `${name}-${++commandSequence}`;
            let resolveBarrier;
            const barrier = new Promise((resolve) => { resolveBarrier = resolve; });
            const result = new Promise((resolve, reject) => {
                pendingCommands.set(id, { resolve, reject, resolveBarrier });
            });
            child.send({ type: "command", id, command, barrier: true, ...payload });
            const boundedResult = withTimeout(result, 15_000, `${name} ${command}`);
            return {
                ready: withTimeout(Promise.race([
                    barrier,
                    boundedResult.then(
                        () => Promise.reject(new Error(`${name} ${command} completed before reaching its barrier.`)),
                        (error) => Promise.reject(error),
                    ),
                ]), 15_000, `${name} ${command} barrier`),
                result: boundedResult,
                release() {
                    child.send({ type: "barrier-release", id });
                },
            };
        },
        async stop() {
            if (child.exitCode !== null || child.signalCode !== null) return;
            const exited = new Promise((resolve) => child.once("exit", resolve));
            child.kill("SIGTERM");
            try {
                await withTimeout(exited, 5_000, `${name} shutdown`);
            } catch {
                child.kill("SIGKILL");
                await exited;
            }
        },
    };
};

const requestJson = async (baseUrl, pathname, options = {}) => {
    const response = await fetch(`${baseUrl}${pathname}`, {
        ...options,
        signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let body = null;
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    return { status: response.status, headers: response.headers, body };
};

test("two API instances coordinate shared state through PostgreSQL", {
    skip: integrationEnabled ? false : "Set RUN_DB_INTEGRATION_TESTS=true with a dedicated TEST_DATABASE_URL.",
    timeout: 90_000,
}, async (t) => {
    const testDatabaseUrl = requireDedicatedTestDatabase();
    const suffix = `${process.pid}-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const accessSecret = "multi-instance-access-secret-with-at-least-32-characters";
    const refreshSecret = "multi-instance-refresh-secret-with-at-least-32-characters";
    const webhookEncryptionKey = "multi-instance-webhook-key-with-at-least-32-characters";
    const privateUploadRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rma-multi-instance-uploads-"));
    t.after(() => fs.rm(privateUploadRoot, { recursive: true, force: true }));
    const environment = {
        DATABASE_URL: testDatabaseUrl,
        NODE_ENV: "test",
        ACCESS_TOKEN_SECRET: accessSecret,
        REFRESH_TOKEN_SECRET: refreshSecret,
        WEBHOOK_ENCRYPTION_KEY: webhookEncryptionKey,
        JWT_ISSUER: "rma-multi-instance-test",
        JWT_AUDIENCE: "rma-multi-instance-api",
        EXPOSE_AUTH_TOKENS_IN_RESPONSE: "true",
        RATE_LIMIT_STORE: "postgres",
        API_RATE_LIMIT_MAX: "5",
        AUTH_RATE_LIMIT_MAX: "100",
        UPLOAD_RATE_LIMIT_MAX: "100",
        TRUST_PROXY: "true",
        OUTBOX_WORKER_ENABLED: "false",
        SLA_WORKER_ENABLED: "false",
        MAINTENANCE_WORKER_ENABLED: "false",
        UPLOAD_STORAGE_PROVIDER: "local",
        LOCAL_PRIVATE_UPLOAD_ROOT: privateUploadRoot,
        FILE_SCAN_REQUIRED: "false",
        LOG_LEVEL: "silent",
        LOG_TO_FILE: "false",
        CORS_ORIGIN: "http://localhost:5173",
    };

    Object.assign(process.env, environment);
    const [
        { default: prisma },
        { generateAccessToken, generateRefreshToken },
        { hashToken },
        { encryptSecret },
    ] = await Promise.all([
        import("../src/db/prisma.js"),
        import("../src/utils/tokenHandler.js"),
        import("../src/utils/tokenSecurity.js"),
        import("../src/utils/encryption.js"),
    ]);

    const instances = [];
    let receiver;
    let organizationId;
    let userId;
    let secondUserId;
    let customerId;
    let inventoryItemId;
    let outboxEventId;
    let webhookEndpointId;
    const rateIp = `198.51.100.${10 + (process.pid % 200)}`;
    const idempotencyKey = `inventory-${suffix}`;

    t.after(async () => {
        await Promise.allSettled(instances.map((instance) => instance.stop()));
        if (receiver?.listening) await new Promise((resolve) => receiver.close(resolve));

        if (outboxEventId) await prisma.outboxEvent.deleteMany({ where: { id: outboxEventId } }).catch(() => undefined);
        if (webhookEndpointId) await prisma.webhookEndpoint.deleteMany({ where: { id: webhookEndpointId } }).catch(() => undefined);
        const userIds = [userId, secondUserId].filter(Boolean);
        if (userIds.length) {
            await prisma.systemLog.deleteMany({ where: { actorId: { in: userIds } } }).catch(() => undefined);
            await prisma.idempotencyRecord.deleteMany({
                where: { actorKey: { in: userIds.map((id) => `USER:${id}`) }, idempotencyKey },
            }).catch(() => undefined);
            await prisma.sessionManagement.deleteMany({ where: { userId: { in: userIds } } }).catch(() => undefined);
        }
        const requestIps = [
            rateIp,
            "198.51.100.211",
            "198.51.100.212",
            "198.51.100.213",
            "198.51.100.221",
            "198.51.100.222",
            "198.51.100.223",
            "198.51.100.224",
        ];
        await prisma.rateLimitBucket.deleteMany({
            where: { key: { in: requestIps.flatMap((ip) => [`api:${ip}`, `auth:${ip}`, `upload:${ip}`]) } },
        }).catch(() => undefined);
        if (inventoryItemId) await prisma.inventoryItem.deleteMany({ where: { id: inventoryItemId } }).catch(() => undefined);
        if (customerId) await prisma.customer.deleteMany({ where: { id: customerId } }).catch(() => undefined);
        if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => undefined);
        if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
        await prisma.$disconnect();
    });

    await prisma.$connect();
    const organization = await prisma.organization.create({
        data: {
            name: `Multi Instance ${suffix}`,
            alias: `MI-${suffix}`,
            isActive: true,
        },
    });
    organizationId = organization.id;
    const user = await prisma.user.create({
        data: {
            firstName: "Multi",
            lastName: "Instance",
            email: `multi-instance-${suffix}@example.test`,
            password: "not-used-in-this-test",
            role: "ADMIN",
            isActive: true,
            isLocked: false,
        },
    });
    userId = user.id;
    const secondUser = await prisma.user.create({
        data: {
            firstName: "Second",
            lastName: "Instance",
            email: `multi-instance-second-${suffix}@example.test`,
            password: "not-used-in-this-test",
            role: "ADMIN",
            isActive: true,
            isLocked: false,
        },
    });
    secondUserId = secondUser.id;
    const customer = await prisma.customer.create({
        data: {
            organizationId,
            companyName: `Multi Instance Customer ${suffix}`,
            customerCode: `MI-CUSTOMER-${suffix}`,
            email: `multi-instance-customer-${suffix}@example.test`,
            password: "not-used-in-this-test",
            isActive: true,
            isLocked: false,
        },
    });
    customerId = customer.id;
    await prisma.$transaction([
        prisma.userOrganization.create({ data: { userId, organizationId } }),
        prisma.userOrganization.create({ data: { userId: secondUserId, organizationId } }),
    ]);
    const inventoryItem = await prisma.inventoryItem.create({
        data: {
            organizationId,
            sku: `MI-${suffix}`,
            name: "Multi-instance inventory",
            quantityOnHand: 1,
            quantityReserved: 0,
            reorderPoint: 0,
            unitCost: "1.00",
        },
    });
    inventoryItemId = inventoryItem.id;
    const accessToken = generateAccessToken(user);
    const secondAccessToken = generateAccessToken(secondUser);

    instances.push(await spawnInstance("instance-a", environment));
    instances.push(await spawnInstance("instance-b", environment));
    const [instanceA, instanceB] = instances;

    await t.test("PostgreSQL rate limiting is shared across both instances", async () => {
        const responses = await Promise.all(Array.from({ length: 12 }, (_, index) => {
            const instance = index % 2 === 0 ? instanceA : instanceB;
            return requestJson(instance.baseUrl, "/api/v1/sessions", {
                headers: { "x-forwarded-for": rateIp },
            });
        }));
        assert.equal(responses.filter(({ status }) => status === 401).length, 5);
        assert.equal(responses.filter(({ status }) => status === 429).length, 7);
        assert.ok(responses.filter(({ status }) => status === 429).every(({ body }) => body?.statusCode === 429));

        const storedBucket = await prisma.rateLimitBucket.findUnique({ where: { key: `api:${rateIp}` } });
        assert.equal(storedBucket?.count, 12);
    });

    await t.test("an idempotent inventory movement mutates stock once and replays across instances", async () => {
        const pathname = `/api/v1/inventory/${inventoryItemId}/movements`;
        const body = JSON.stringify({ type: "RESERVE", quantity: 1, reason: `Concurrent ${suffix}` });
        const headers = {
            authorization: `Bearer ${accessToken}`,
            "content-type": "application/json",
            "idempotency-key": idempotencyKey,
            "x-forwarded-for": "198.51.100.211",
        };
        const concurrent = await Promise.all([
            requestJson(instanceA.baseUrl, pathname, { method: "POST", headers, body }),
            requestJson(instanceB.baseUrl, pathname, { method: "POST", headers, body }),
        ]);
        assert.ok(concurrent.every(({ status }) => status === 201 || status === 409));
        const successful = concurrent.filter(({ status }) => status === 201);
        assert.ok(successful.length >= 1);

        const stored = await prisma.inventoryItem.findUnique({
            where: { id: inventoryItemId },
            include: { movements: true },
        });
        assert.equal(stored.quantityReserved, 1);
        assert.equal(stored.movements.length, 1);

        const replay = await requestJson(instanceB.baseUrl, pathname, { method: "POST", headers, body });
        assert.equal(replay.status, 201);
        assert.equal(replay.body.data.movement.id, stored.movements[0].id);
        const afterReplay = await prisma.inventoryMovement.count({ where: { inventoryItemId } });
        assert.equal(afterReplay, 1);

        const conflictingReuse = await requestJson(instanceA.baseUrl, pathname, {
            method: "POST",
            headers,
            body: JSON.stringify({ type: "RECEIVE", quantity: 1, reason: `Different ${suffix}` }),
        });
        assert.equal(conflictingReuse.status, 409);
        assert.match(conflictingReuse.body.message, /different request/i);
        assert.equal(await prisma.inventoryMovement.count({ where: { inventoryItemId } }), 1);

        const otherActor = await requestJson(instanceB.baseUrl, pathname, {
            method: "POST",
            headers: { ...headers, authorization: `Bearer ${secondAccessToken}` },
            body: JSON.stringify({ type: "RELEASE", quantity: 1, reason: `Other actor ${suffix}` }),
        });
        assert.equal(otherActor.status, 201);
        assert.equal(otherActor.body.data.item.quantityReserved, 0);
        assert.equal(await prisma.inventoryMovement.count({ where: { inventoryItemId } }), 2);
    });

    await t.test("the real organization upload route stores and serves a logo across instances", async () => {
        const logo = Buffer.from(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
            "base64",
        );
        const form = new FormData();
        form.append("logo", new Blob([logo], { type: "image/png" }), "organization-logo.png");
        const uploaded = await fetch(`${instanceA.baseUrl}/api/v1/organizations/${organizationId}/logo`, {
            method: "PUT",
            headers: {
                authorization: `Bearer ${accessToken}`,
                "x-forwarded-for": "198.51.100.212",
            },
            body: form,
            signal: AbortSignal.timeout(10_000),
        });
        assert.equal(uploaded.status, 200);
        const uploadBody = await uploaded.json();
        assert.equal(uploadBody.data.logo.mimeType, "image/png");
        assert.equal(uploadBody.data.logo.size, logo.length);

        const downloaded = await fetch(`${instanceB.baseUrl}/api/v1/organizations/${organizationId}/logo`, {
            headers: {
                authorization: `Bearer ${accessToken}`,
                "x-forwarded-for": "198.51.100.213",
            },
            signal: AbortSignal.timeout(10_000),
        });
        assert.equal(downloaded.status, 200);
        assert.equal(downloaded.headers.get("content-type"), "image/png");
        assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), logo);

        const removed = await requestJson(instanceB.baseUrl, `/api/v1/organizations/${organizationId}/logo`, {
            method: "DELETE",
            headers: {
                authorization: `Bearer ${accessToken}`,
                "x-forwarded-for": "198.51.100.213",
            },
        });
        assert.equal(removed.status, 200);
        assert.equal(removed.body.data.logo, null);
        const storedOrganization = await prisma.organization.findUnique({ where: { id: organizationId } });
        assert.equal(storedOrganization.logoFileName, null);
    });

    await t.test("competing outbox workers deliver one webhook once", async () => {
        const now = new Date();
        const processableEvents = await prisma.outboxEvent.count({
            where: {
                OR: [
                    { status: { in: ["PENDING", "FAILED"] }, availableAt: { lte: now } },
                    { status: "PROCESSING", lockedAt: { lt: new Date(now.getTime() - 5 * 60_000) } },
                ],
            },
        });
        assert.equal(
            processableEvents,
            0,
            "The dedicated test database outbox must be empty; run database integration files serially.",
        );

        const deliveries = [];
        receiver = http.createServer(async (req, res) => {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            deliveries.push({
                body: Buffer.concat(chunks).toString("utf8"),
                event: req.headers["x-rma-event"],
                signature: req.headers["x-rma-signature"],
            });
            await delay(100);
            res.statusCode = 204;
            res.end();
        });
        await new Promise((resolve) => receiver.listen(0, "127.0.0.1", resolve));
        const receiverAddress = receiver.address();
        const eventType = `multi_instance.${suffix}`;
        const endpoint = await prisma.webhookEndpoint.create({
            data: {
                organizationId,
                url: `http://127.0.0.1:${receiverAddress.port}/webhook/${suffix}`,
                secretCiphertext: encryptSecret("multi-instance-signing-secret"),
                events: [eventType],
                createdBy: userId,
            },
        });
        webhookEndpointId = endpoint.id;
        const event = await prisma.outboxEvent.create({
            data: {
                organizationId,
                eventType,
                aggregateType: "MultiInstanceTest",
                aggregateId: suffix,
                payload: { suffix },
                availableAt: new Date(Date.now() - 1000),
            },
        });
        outboxEventId = event.id;

        const workers = [
            instanceA.barrierCommand("process-outbox", { limit: 1 }),
            instanceB.barrierCommand("process-outbox", { limit: 1 }),
        ];
        try {
            await Promise.all(workers.map(({ ready }) => ready));
        } finally {
            for (const worker of workers) worker.release();
        }
        await Promise.all(workers.map(({ result }) => result));

        assert.equal(deliveries.length, 1);
        const expectedSignature = createHmac("sha256", "multi-instance-signing-secret")
            .update(deliveries[0].body)
            .digest("hex");
        assert.equal(deliveries[0].event, eventType);
        assert.equal(deliveries[0].signature, `sha256=${expectedSignature}`);
        assert.equal(JSON.parse(deliveries[0].body).id, String(event.id));

        const stored = await prisma.outboxEvent.findUnique({
            where: { id: event.id },
            include: { deliveries: true },
        });
        assert.equal(stored.status, "SENT");
        assert.equal(stored.attempts, 1);
        assert.equal(stored.deliveries.length, 1);
        assert.equal(stored.deliveries[0].status, "SENT");
        assert.equal(stored.deliveries[0].attempts, 1);
    });

    await t.test("refresh-token rotation permits only one concurrent consumer for each actor type", async () => {
        const requestRefresh = (instance, ip, token) => requestJson(instance.baseUrl, "/api/v1/sessions/refresh", {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": ip },
            body: JSON.stringify({ refreshToken: token }),
        });

        const assertAtomicRotation = async ({ actor, createSession, ipSuffix }) => {
            const refreshToken = generateRefreshToken(actor);
            await createSession(refreshToken);
            const consumers = [
                instanceA.barrierCommand("refresh-session", { refreshToken }),
                instanceB.barrierCommand("refresh-session", { refreshToken }),
            ];
            try {
                await Promise.all(consumers.map(({ ready }) => ready));
            } finally {
                for (const consumer of consumers) consumer.release();
            }
            const concurrent = await Promise.allSettled(consumers.map(({ result }) => result));
            const winners = concurrent.filter(({ status }) => status === "fulfilled");
            const losers = concurrent.filter(({ status }) => status === "rejected");
            assert.equal(winners.length, 1);
            assert.equal(losers.length, 1);
            assert.ok(winners[0].value.refreshToken);

            const replayedOldToken = await requestRefresh(instanceA, `198.51.100.${ipSuffix}`, refreshToken);
            assert.equal(replayedOldToken.status, 401);
            const rotatedToken = await requestRefresh(instanceB, `198.51.100.${ipSuffix + 1}`, winners[0].value.refreshToken);
            assert.equal(rotatedToken.status, 200);
        };

        await assertAtomicRotation({
            actor: user,
            ipSuffix: 221,
            createSession: (refreshToken) => prisma.sessionManagement.create({
                data: {
                    userId,
                    refreshToken: null,
                    refreshTokenHash: hashToken(refreshToken),
                    expiresAt: new Date(Date.now() + 60_000),
                },
            }),
        });
        await assertAtomicRotation({
            actor: customer,
            ipSuffix: 223,
            createSession: (refreshToken) => prisma.customerSession.create({
                data: {
                    customerId,
                    refreshTokenHash: hashToken(refreshToken),
                    expiresAt: new Date(Date.now() + 60_000),
                },
            }),
        });
    });
});
