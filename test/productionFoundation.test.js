import test from "node:test";
import assert from "node:assert/strict";
import { readTaxRate } from "../src/config/env.js";
import { ALLOWED_TRANSITIONS } from "../src/services/repairworkflow.service.js";
import { validateWebhookUrl } from "../src/services/integration.service.js";
import { decryptSecret, encryptSecret } from "../src/utils/encryption.js";
import { hashToken, safeEqual } from "../src/utils/tokenSecurity.js";
import { liveness } from "../src/services/health.service.js";
import { totpAt, verifyTotp } from "../src/utils/totp.js";
import { verifyCsrf } from "../src/middlewares/csrf.middleware.js";
import { toPublicOrganization } from "../src/services/organization.service.js";
import { parseTenantCredentials } from "../src/services/customerAuth.service.js";
import { sanitizeRequestPath } from "../src/utils/requestSanitizer.js";
import { calculateTax, money, multiplyMoney, sumMoney } from "../src/utils/money.js";

test("tax rates accept fractions and legacy percentage values", () => {
    assert.equal(readTaxRate("0.15"), 0.15);
    assert.equal(readTaxRate("15"), 0.15);
    assert.throws(() => readTaxRate("150"), /no greater than 100%/);
});

test("repair workflow prevents invalid terminal-state transitions", () => {
    assert.equal(ALLOWED_TRANSITIONS.CREATED.has("RECEIVED"), true);
    assert.equal(ALLOWED_TRANSITIONS.CREATED.has("COMPLETED"), false);
    assert.equal(ALLOWED_TRANSITIONS.COMPLETED.size, 0);
    assert.equal(ALLOWED_TRANSITIONS.CANCELLED.size, 0);
});

test("webhook validation rejects local and private targets", () => {
    assert.throws(() => validateWebhookUrl("http://localhost/hook"), /Private webhook/);
    assert.throws(() => validateWebhookUrl("http://10.0.0.8/hook"), /Private webhook/);
    assert.equal(validateWebhookUrl("https://hooks.example.com/rma"), "https://hooks.example.com/rma");
});

test("integration secrets are encrypted and token hashes are deterministic", () => {
    process.env.WEBHOOK_ENCRYPTION_KEY = "test-webhook-encryption-key-with-sufficient-entropy";
    const encrypted = encryptSecret("signing-secret");
    assert.notEqual(encrypted, "signing-secret");
    assert.equal(decryptSecret(encrypted), "signing-secret");
    assert.equal(hashToken("one"), hashToken("one"));
    assert.notEqual(hashToken("one"), hashToken("two"));
    assert.equal(safeEqual("same", "same"), true);
    assert.equal(safeEqual("same", "different"), false);
});

test("liveness payload is machine readable", () => {
    const result = liveness();
    assert.equal(result.status, "ok");
    assert.equal(typeof result.uptimeSeconds, "number");
    assert.equal(Number.isNaN(Date.parse(result.timestamp)), false);
});

test("TOTP verification accepts the current code and rejects malformed codes", () => {
    const secret = "JBSWY3DPEHPK3PXP";
    const timestamp = 1_700_000_000_000;
    assert.equal(verifyTotp(secret, totpAt(secret, timestamp), timestamp), true);
    assert.equal(verifyTotp(secret, "not-a-code", timestamp), false);
});

test("cookie-authenticated writes require a matching CSRF token", () => {
    let nextCalled = false;
    const response = { statusCode: 0, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    verifyCsrf({ method: "POST", cookies: { accessToken: "jwt", csrfToken: "csrf" }, headers: { "x-csrf-token": "csrf" } }, response, () => { nextCalled = true; });
    assert.equal(nextCalled, true);

    const rejected = { ...response, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    verifyCsrf({ method: "POST", cookies: { accessToken: "jwt", csrfToken: "csrf" }, headers: {} }, rejected, () => {});
    assert.equal(rejected.statusCode, 403);
});

test("request logging redacts activation and query tokens", () => {
    const sanitized = sanitizeRequestPath("/api/v1/users/activeuser/top-secret?token=also-secret&safe=yes");
    assert.equal(sanitized.includes("top-secret"), false);
    assert.equal(sanitized.includes("also-secret"), false);
    assert.equal(sanitized.includes("safe=yes"), true);
    assert.equal(sanitizeRequestPath("/api/v1/users/activate/top-secret").includes("top-secret"), false);
    assert.equal(sanitizeRequestPath("/api/v1/customers/password-reset/top-secret").includes("top-secret"), false);
    assert.equal(
        sanitizeRequestPath("/api/v1/customers/password-reset/request"),
        "/api/v1/customers/password-reset/request",
    );
});

test("organization responses expose a scoped logo URL without storage metadata", () => {
    const organization = toPublicOrganization({
        id: 42,
        name: "Test Organization",
        alias: "TO",
        logoFileName: "private-logo.png",
        logoMimeType: "image/png",
        logoFileSize: 1024,
        logoFileHash: "sensitive-storage-hash",
        logoUpdatedAt: new Date("2026-07-18T00:00:00.000Z"),
    });

    assert.equal(organization.logo.url, "/api/v1/organizations/42/logo");
    assert.equal(organization.logo.mimeType, "image/png");
    assert.equal(organization.logoFileName, undefined);
    assert.equal(organization.logoFileHash, undefined);
});

test("customer authentication credentials require and normalize an explicit tenant", () => {
    const credentials = parseTenantCredentials({
        organizationId: "42",
        email: " Customer@Example.Test ",
        password: "Password123!",
    }, { requirePassword: true });
    assert.deepEqual(credentials, {
        organizationId: 42,
        email: "customer@example.test",
        password: "Password123!",
    });
    assert.throws(
        () => parseTenantCredentials({ email: "customer@example.test", password: "Password123!" }, { requirePassword: true }),
        /organizationId/
    );
});

test("money arithmetic rounds once with decimal half-up semantics", () => {
    const lines = [multiplyMoney(money("0.10"), 3), money("0.20")];
    const subtotal = sumMoney(lines);
    const tax = calculateTax(subtotal, "0.15");
    assert.equal(subtotal.toFixed(2), "0.50");
    assert.equal(tax.toFixed(2), "0.08");
    assert.equal(subtotal.plus(tax).toFixed(2), "0.58");
    assert.equal(money("1.005").toFixed(2), "1.01");
});
