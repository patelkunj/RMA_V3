#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as delay } from "node:timers/promises";

const NORMAL_LIMITS = Object.freeze({
    durationSeconds: 60,
    warmupSeconds: 15,
    concurrency: 20,
    requestsPerSecond: 50,
    totalRequests: 3_000,
});

const HIGH_INTENSITY_LIMITS = Object.freeze({
    durationSeconds: 900,
    warmupSeconds: 60,
    concurrency: 200,
    requestsPerSecond: 1_000,
    totalRequests: 250_000,
});

const PROFILE_NAMES = new Set(["health", "authenticated-read"]);

const readBoolean = (name, fallback = false) => {
    const value = process.env[name];
    if (value === undefined || value === "") return fallback;
    if (value === "true" || value === "1") return true;
    if (value === "false" || value === "0") return false;
    throw new Error(`${name} must be true or false.`);
};

const readPositiveNumber = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number.`);
    return value;
};

const readPositiveInteger = (name, fallback) => {
    const value = readPositiveNumber(name, fallback);
    if (!Number.isInteger(value)) throw new Error(`${name} must be a positive integer.`);
    return value;
};

const readRate = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error(`${name} must be a number between 0 and 1.`);
    }
    return value;
};

const readNonNegativeNumber = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative number.`);
    return value;
};

const isLoopbackHost = (hostname) => {
    const normalized = String(hostname).toLowerCase().replace(/^\[|\]$/g, "");
    if (normalized === "localhost" || normalized === "::1") return true;
    const octets = normalized.split(".");
    return octets.length === 4
        && octets[0] === "127"
        && octets.every((octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255);
};

const parseTarget = () => {
    const raw = String(process.env.LOAD_TEST_BASE_URL || "http://127.0.0.1:3000").trim();
    let url;
    try {
        url = new URL(raw);
    } catch {
        throw new Error("LOAD_TEST_BASE_URL must be a valid absolute URL.");
    }

    if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("LOAD_TEST_BASE_URL must use HTTP or HTTPS.");
    }
    if (url.username || url.password) throw new Error("LOAD_TEST_BASE_URL must not contain credentials.");
    if (url.pathname !== "/" || url.search || url.hash) {
        throw new Error("LOAD_TEST_BASE_URL must contain only an origin, without a path, query, or fragment.");
    }

    const loopback = isLoopbackHost(url.hostname);
    if (!loopback) {
        if (!readBoolean("LOAD_TEST_ALLOW_REMOTE")) {
            throw new Error("Remote load-test targets require LOAD_TEST_ALLOW_REMOTE=true.");
        }
        if (String(process.env.LOAD_TEST_CONFIRM_ORIGIN || "").trim() !== url.origin) {
            throw new Error(`LOAD_TEST_CONFIRM_ORIGIN must exactly match ${url.origin}.`);
        }
        if (url.protocol !== "https:") {
            throw new Error("Remote load-test targets must use HTTPS.");
        }
    }

    return { origin: url.origin, loopback };
};

const enforceLimit = (name, value, maximum, highIntensity) => {
    if (value > maximum) {
        const hint = highIntensity
            ? "The absolute high-intensity safety limit cannot be exceeded."
            : "Set LOAD_TEST_ALLOW_HIGH_INTENSITY=true only for an approved isolated performance environment.";
        throw new Error(`${name} exceeds its safety limit of ${maximum}. ${hint}`);
    }
};

const readConfig = () => {
    if (String(process.env.NODE_ENV || "").toLowerCase() === "production") {
        throw new Error("Load testing is disabled when NODE_ENV=production.");
    }

    const profile = String(process.env.LOAD_TEST_PROFILE || "health").trim().toLowerCase();
    if (!PROFILE_NAMES.has(profile)) {
        throw new Error(`LOAD_TEST_PROFILE must be one of: ${[...PROFILE_NAMES].join(", ")}.`);
    }

    const durationSeconds = readPositiveNumber("LOAD_TEST_DURATION_SECONDS", 15);
    const warmupSeconds = readPositiveNumber("LOAD_TEST_WARMUP_SECONDS", 3);
    const concurrency = readPositiveInteger("LOAD_TEST_CONCURRENCY", 4);
    const requestsPerSecond = readPositiveNumber("LOAD_TEST_RPS", 10);
    const timeoutMs = readPositiveInteger("LOAD_TEST_TIMEOUT_MS", 5_000);
    const measuredRequests = Math.floor(durationSeconds * requestsPerSecond);
    const warmupRequestsPerSecond = Math.min(requestsPerSecond, concurrency);
    const warmupRequests = Math.floor(warmupSeconds * warmupRequestsPerSecond);
    const totalRequests = measuredRequests + warmupRequests;
    if (measuredRequests < 1) throw new Error("The configured duration and request rate must schedule at least one request.");

    const highIntensity = readBoolean("LOAD_TEST_ALLOW_HIGH_INTENSITY");
    const limits = highIntensity ? HIGH_INTENSITY_LIMITS : NORMAL_LIMITS;
    enforceLimit("LOAD_TEST_DURATION_SECONDS", durationSeconds, limits.durationSeconds, highIntensity);
    enforceLimit("LOAD_TEST_WARMUP_SECONDS", warmupSeconds, limits.warmupSeconds, highIntensity);
    enforceLimit("LOAD_TEST_CONCURRENCY", concurrency, limits.concurrency, highIntensity);
    enforceLimit("LOAD_TEST_RPS", requestsPerSecond, limits.requestsPerSecond, highIntensity);
    enforceLimit("Scheduled request count", totalRequests, limits.totalRequests, highIntensity);
    enforceLimit("LOAD_TEST_TIMEOUT_MS", timeoutMs, 30_000, highIntensity);

    return {
        profile,
        durationSeconds,
        warmupSeconds,
        concurrency,
        requestsPerSecond,
        timeoutMs,
        measuredRequests,
        warmupRequests,
        totalRequests,
        highIntensity,
        thresholds: {
            maxErrorRate: readRate("LOAD_TEST_MAX_ERROR_RATE", 0.01),
            max5xxRate: readRate("LOAD_TEST_MAX_5XX_RATE", 0),
            max429Rate: readRate("LOAD_TEST_MAX_429_RATE", 0),
            maxP95Ms: readPositiveNumber("LOAD_TEST_MAX_P95_MS", 500),
            maxP99Ms: readPositiveNumber("LOAD_TEST_MAX_P99_MS", 1_000),
            minSuccessRps: readNonNegativeNumber("LOAD_TEST_MIN_RPS", requestsPerSecond * 0.8),
        },
        reportPath: path.resolve(
            process.env.LOAD_TEST_REPORT_PATH || path.join(os.tmpdir(), "rma-load-test-report.json"),
        ),
    };
};

const endpointProfiles = {
    health: [
        {
            name: "liveness",
            path: "/health/live",
            weight: 4,
            validate: (body) => body?.status === "ok",
        },
        {
            name: "readiness",
            path: "/health/ready",
            weight: 1,
            validate: (body) => body?.status === "ready" && body?.checks?.database?.status === "ok",
        },
    ],
    "authenticated-read": [
        {
            name: "repair-jobs",
            path: "/api/v1/repair-jobs?status=CREATED&page=1&limit=25",
            weight: 5,
            validate: (body) => body?.statusCode === 200 && body?.success === true,
        },
        {
            name: "products",
            path: "/api/v1/products?page=1&limit=25",
            weight: 3,
            validate: (body) => body?.statusCode === 200 && body?.success === true,
        },
        {
            name: "notifications",
            path: "/api/v1/notifications?page=1&limit=20",
            weight: 2,
            validate: (body) => body?.statusCode === 200 && body?.success === true,
        },
    ],
};

const expandWeightedEndpoints = (profile) => endpointProfiles[profile].flatMap((endpoint) =>
    Array.from({ length: endpoint.weight }, () => endpoint),
);

const parseJson = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const request = async ({ origin, endpoint, timeoutMs, accessToken, sequence }) => {
    const startedAt = performance.now();
    try {
        const response = await fetch(new URL(endpoint.path, origin), {
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
                "User-Agent": "rma-safe-load-test/1.0",
                "X-Request-Id": `load-test-${process.pid}-${sequence}`,
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
        });
        const bodyBuffer = await response.arrayBuffer();
        const latencyMs = performance.now() - startedAt;
        const body = parseJson(Buffer.from(bodyBuffer).toString("utf8"));
        const statusExpected = response.status === 200;
        const bodyValid = statusExpected && endpoint.validate(body);
        return {
            status: response.status,
            latencyMs,
            bytes: bodyBuffer.byteLength,
            success: bodyValid,
            errorType: statusExpected ? (bodyValid ? null : "invalid_response") : "unexpected_status",
        };
    } catch (error) {
        return {
            status: null,
            latencyMs: performance.now() - startedAt,
            bytes: 0,
            success: false,
            errorType: error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "network_error",
        };
    }
};

const preflight = async (origin, timeoutMs) => {
    const result = await request({
        origin,
        endpoint: endpointProfiles.health[1],
        timeoutMs,
        accessToken: null,
        sequence: "preflight",
    });
    if (!result.success) {
        throw new Error(`Readiness preflight failed with ${result.status === null ? result.errorType : `HTTP ${result.status}`}.`);
    }
};

const login = async (origin, timeoutMs) => {
    const configuredToken = String(process.env.LOAD_TEST_ACCESS_TOKEN || "").trim();
    if (configuredToken) return { accessToken: configuredToken, source: "provided" };

    const email = String(process.env.LOAD_TEST_USER_EMAIL || "").trim();
    const password = String(process.env.LOAD_TEST_USER_PASSWORD || "");
    if (!email || !password) {
        throw new Error("The authenticated-read profile requires LOAD_TEST_ACCESS_TOKEN or load-test user credentials.");
    }

    const mfaCode = String(process.env.LOAD_TEST_MFA_CODE || "").trim();
    let response;
    try {
        response = await fetch(new URL("/api/v1/users/login", origin), {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                "User-Agent": "rma-safe-load-test/1.0",
            },
            body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
        });
    } catch (error) {
        const type = error?.name === "TimeoutError" || error?.name === "AbortError" ? "timed out" : "failed";
        throw new Error(`Load-test authentication ${type}; no requests were started.`);
    }

    const body = parseJson(await response.text());
    if (response.status === 202) {
        throw new Error("Load-test authentication requires MFA; supply a valid LOAD_TEST_MFA_CODE or access token.");
    }
    if (response.status !== 200 || !body?.data?.accessToken) {
        throw new Error(`Load-test authentication failed with HTTP ${response.status}; credentials were not retried.`);
    }
    return {
        accessToken: body.data.accessToken,
        refreshToken: body.data.refreshToken,
        source: "login",
    };
};

const logout = async (origin, timeoutMs, session) => {
    if (session?.source !== "login" || !session.refreshToken) return;
    try {
        await fetch(new URL("/api/v1/users/logout", origin), {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(timeoutMs),
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${session.accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": "rma-safe-load-test/1.0",
            },
            body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
    } catch {
        // Cleanup is best-effort and must not replace the load-test result.
    }
};

const createStats = (name) => ({
    name,
    scheduled: 0,
    started: 0,
    finished: 0,
    successful: 0,
    failed: 0,
    dropped: 0,
    bytes: 0,
    latenciesMs: [],
    statuses: new Map(),
    errors: new Map(),
});

const incrementMap = (map, key) => map.set(String(key), (map.get(String(key)) || 0) + 1);

const createCollector = (endpointNames) => {
    const overall = createStats("overall");
    const endpoints = new Map(endpointNames.map((name) => [name, createStats(name)]));
    const targets = (endpoint) => [overall, endpoints.get(endpoint.name)];

    return {
        scheduled(endpoint) {
            for (const stats of targets(endpoint)) stats.scheduled += 1;
        },
        dropped(endpoint) {
            for (const stats of targets(endpoint)) {
                stats.failed += 1;
                stats.dropped += 1;
                incrementMap(stats.errors, "concurrency_saturated");
            }
        },
        result(endpoint, result) {
            for (const stats of targets(endpoint)) {
                stats.started += 1;
                stats.finished += 1;
                stats.bytes += result.bytes;
                stats.latenciesMs.push(result.latencyMs);
                if (result.status !== null) incrementMap(stats.statuses, result.status);
                if (result.success) {
                    stats.successful += 1;
                } else {
                    stats.failed += 1;
                    incrementMap(stats.errors, result.errorType || "unknown_error");
                }
            }
        },
        overall,
        endpoints,
    };
};

const runFixedRate = async ({
    origin,
    endpoints,
    durationSeconds,
    requestsPerSecond,
    concurrency,
    timeoutMs,
    accessToken,
    collector,
    failOnError = false,
}) => {
    const intervalMs = 1_000 / requestsPerSecond;
    const requestCount = Math.floor(durationSeconds * requestsPerSecond);
    const active = new Set();
    let warmupFailed = false;
    const startedAt = performance.now();

    for (let index = 0; index < requestCount; index += 1) {
        const scheduledAt = startedAt + (index * intervalMs);
        const waitMs = scheduledAt - performance.now();
        if (waitMs > 0) await delay(waitMs);

        const endpoint = endpoints[index % endpoints.length];
        collector?.scheduled(endpoint);
        if (active.size >= concurrency) {
            collector?.dropped(endpoint);
            warmupFailed = true;
            continue;
        }

        let task;
        task = request({
            origin,
            endpoint,
            timeoutMs,
            accessToken,
            sequence: index,
        }).then((result) => {
            collector?.result(endpoint, result);
            if (!result.success) warmupFailed = true;
        }).finally(() => active.delete(task));
        active.add(task);
    }

    const remainingDurationMs = (startedAt + (durationSeconds * 1_000)) - performance.now();
    if (remainingDurationMs > 0) await delay(remainingDurationMs);
    await Promise.allSettled([...active]);

    if (failOnError && warmupFailed) throw new Error("Warm-up requests failed; the measured phase was not started.");
    return (performance.now() - startedAt) / 1_000;
};

const percentile = (values, percentileValue) => {
    if (!values.length) return null;
    const ordered = [...values].sort((left, right) => left - right);
    const index = Math.max(Math.ceil(percentileValue * ordered.length) - 1, 0);
    return ordered[index];
};

const round = (value, digits = 3) => value === null ? null : Number(value.toFixed(digits));

const mapToObject = (map) => Object.fromEntries(
    [...map.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })),
);

const summarizeStats = (stats, elapsedSeconds) => ({
    scheduled: stats.scheduled,
    started: stats.started,
    finished: stats.finished,
    successful: stats.successful,
    failed: stats.failed,
    dropped: stats.dropped,
    bytes: stats.bytes,
    errorRate: round(stats.scheduled ? stats.failed / stats.scheduled : 1, 6),
    requestRps: round(stats.finished / elapsedSeconds),
    successRps: round(stats.successful / elapsedSeconds),
    latencyMs: {
        p50: round(percentile(stats.latenciesMs, 0.50)),
        p95: round(percentile(stats.latenciesMs, 0.95)),
        p99: round(percentile(stats.latenciesMs, 0.99)),
        max: stats.latenciesMs.length
            ? round(stats.latenciesMs.reduce((maximum, value) => Math.max(maximum, value), 0))
            : null,
    },
    statusCounts: mapToObject(stats.statuses),
    errorCounts: mapToObject(stats.errors),
});

const statusClassCount = (statusCounts, minimum, maximum) => Object.entries(statusCounts)
    .filter(([status]) => Number(status) >= minimum && Number(status) <= maximum)
    .reduce((total, [, count]) => total + count, 0);

const evaluateThresholds = (metrics, thresholds) => {
    const scheduled = metrics.scheduled || 1;
    const serverErrorRate = statusClassCount(metrics.statusCounts, 500, 599) / scheduled;
    const rateLimitedRate = Number(metrics.statusCounts["429"] || 0) / scheduled;
    const checks = [
        { name: "errorRate", operator: "<=", expected: thresholds.maxErrorRate, actual: metrics.errorRate },
        { name: "serverErrorRate", operator: "<=", expected: thresholds.max5xxRate, actual: serverErrorRate },
        { name: "rateLimitedRate", operator: "<=", expected: thresholds.max429Rate, actual: rateLimitedRate },
        { name: "latencyP95Ms", operator: "<=", expected: thresholds.maxP95Ms, actual: metrics.latencyMs.p95 },
        { name: "latencyP99Ms", operator: "<=", expected: thresholds.maxP99Ms, actual: metrics.latencyMs.p99 },
        { name: "successRps", operator: ">=", expected: thresholds.minSuccessRps, actual: metrics.successRps },
    ].map((check) => ({
        ...check,
        actual: round(check.actual, 6),
        passed: check.actual !== null && (check.operator === "<="
            ? check.actual <= check.expected
            : check.actual >= check.expected),
    }));
    return { passed: checks.every((check) => check.passed), checks };
};

const writeReport = async (reportPath, report) => {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
};

const run = async () => {
    if (!readBoolean("RUN_LOAD_TESTS")) {
        console.log("Load test skipped. Set RUN_LOAD_TESTS=true to opt in.");
        return;
    }

    const target = parseTarget();
    const config = readConfig();
    const endpoints = expandWeightedEndpoints(config.profile);
    let session;

    await preflight(target.origin, config.timeoutMs);
    if (config.profile === "authenticated-read") {
        session = await login(target.origin, config.timeoutMs);
    }

    try {
        await runFixedRate({
            origin: target.origin,
            endpoints,
            durationSeconds: config.warmupSeconds,
            requestsPerSecond: Math.min(config.requestsPerSecond, config.concurrency),
            concurrency: config.concurrency,
            timeoutMs: config.timeoutMs,
            accessToken: session?.accessToken,
            collector: null,
            failOnError: true,
        });

        const collector = createCollector(endpointProfiles[config.profile].map(({ name }) => name));
        const elapsedSeconds = await runFixedRate({
            origin: target.origin,
            endpoints,
            durationSeconds: config.durationSeconds,
            requestsPerSecond: config.requestsPerSecond,
            concurrency: config.concurrency,
            timeoutMs: config.timeoutMs,
            accessToken: session?.accessToken,
            collector,
        });

        const overall = summarizeStats(collector.overall, elapsedSeconds);
        const endpointMetrics = Object.fromEntries([...collector.endpoints.entries()].map(([name, stats]) => [
            name,
            summarizeStats(stats, elapsedSeconds),
        ]));
        const thresholdResult = evaluateThresholds(overall, config.thresholds);
        const report = {
            schemaVersion: 1,
            generatedAt: new Date().toISOString(),
            profile: config.profile,
            target: { origin: target.origin, loopback: target.loopback },
            config: {
                durationSeconds: config.durationSeconds,
                warmupSeconds: config.warmupSeconds,
                concurrency: config.concurrency,
                requestsPerSecond: config.requestsPerSecond,
                timeoutMs: config.timeoutMs,
                measuredScheduledRequests: config.measuredRequests,
                warmupScheduledRequests: config.warmupRequests,
                totalScheduledRequests: config.totalRequests,
                highIntensity: config.highIntensity,
            },
            elapsedSeconds: round(elapsedSeconds),
            metrics: { overall, endpoints: endpointMetrics },
            thresholds: thresholdResult,
        };

        await writeReport(config.reportPath, report);
        console.log(JSON.stringify({
            profile: report.profile,
            target: report.target,
            elapsedSeconds: report.elapsedSeconds,
            metrics: report.metrics,
            thresholds: report.thresholds,
            reportPath: config.reportPath,
        }, null, 2));

        if (!thresholdResult.passed) process.exitCode = 1;
    } finally {
        await logout(target.origin, config.timeoutMs, session);
    }
};

run().catch((error) => {
    console.error(`Load test aborted safely: ${error instanceof Error ? error.message : "Unknown error"}`);
    process.exitCode = 1;
});
