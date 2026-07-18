import assert from "node:assert/strict";
import test from "node:test";

process.env.NODE_ENV = "test";
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || "http-security-access-secret";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "http-security-refresh-secret";
process.env.CORS_ORIGIN = "https://allowed.example.test";
process.env.METRICS_TOKEN = "http-security-metrics-token";
process.env.RATE_LIMIT_STORE = "memory";
process.env.API_RATE_LIMIT_MAX = "1000";
process.env.AUTH_RATE_LIMIT_MAX = "1000";

const { app } = await import("../src/app.js");
const httpIntegrationEnabled = process.env.RUN_HTTP_INTEGRATION_TESTS === "true";

const canonicalError = (body, statusCode, message) => {
    assert.deepEqual(body, {
        statusCode,
        data: null,
        message,
        success: false,
        errors: [],
    });
};

test("HTTP boundary applies security, authorization, parser, CORS, and metrics contracts", {
    skip: httpIntegrationEnabled ? false : "Set RUN_HTTP_INTEGRATION_TESTS=true where loopback listeners are allowed.",
}, async (t) => {
    const server = await new Promise((resolve) => {
        const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
    });
    t.after(() => new Promise((resolve) => server.close(resolve)));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    await t.test("liveness responses include defensive headers and request correlation", async () => {
        const response = await fetch(`${baseUrl}/health/live`, { headers: { "x-request-id": "security-contract-request" } });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("x-frame-options"), "DENY");
        assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        assert.equal(response.headers.get("x-powered-by"), null);
        assert.equal(response.headers.get("x-request-id"), "security-contract-request");
    });

    await t.test("protected resources reject anonymous requests with the canonical envelope", async () => {
        const response = await fetch(`${baseUrl}/api/v1/inventory`);
        assert.equal(response.status, 401);
        canonicalError(await response.json(), 401, "Unauthorized request");
    });

    await t.test("malformed and oversized JSON never expose parser internals", async () => {
        const malformed = await fetch(`${baseUrl}/api/v1/users/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "{",
        });
        assert.equal(malformed.status, 400);
        canonicalError(await malformed.json(), 400, "Invalid request.");

        const oversized = await fetch(`${baseUrl}/api/v1/users/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email: `${"x".repeat(17_000)}@example.test`, password: "Password123!" }),
        });
        assert.equal(oversized.status, 413);
        canonicalError(await oversized.json(), 413, "Request payload is too large.");
    });

    await t.test("untrusted browser origins are rejected consistently", async () => {
        const response = await fetch(`${baseUrl}/health/live`, { headers: { origin: "https://untrusted.example.test" } });
        assert.equal(response.status, 403);
        canonicalError(await response.json(), 403, "CORS origin is not allowed");
    });

    await t.test("metrics require their dedicated bearer token", async () => {
        const denied = await fetch(`${baseUrl}/metrics`);
        assert.equal(denied.status, 401);
        canonicalError(await denied.json(), 401, "Metrics credentials are invalid.");

        const allowed = await fetch(`${baseUrl}/metrics`, {
            headers: { authorization: "Bearer http-security-metrics-token" },
        });
        assert.equal(allowed.status, 200);
        assert.match(allowed.headers.get("content-type"), /^text\/plain/);
        assert.match(await allowed.text(), /rma_http_requests_total/);
    });

    await t.test("unknown routes return the canonical not-found response", async () => {
        const response = await fetch(`${baseUrl}/api/v1/not-a-real-resource`);
        assert.equal(response.status, 404);
        canonicalError(await response.json(), 404, "Route not found");
    });
});
