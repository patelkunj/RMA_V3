import test from "node:test";
import assert from "node:assert/strict";

const integrationEnabled = process.env.RUN_DB_INTEGRATION_TESTS === "true";

test("customer authentication and data access remain scoped to the selected tenant", {
    skip: integrationEnabled ? false : "Set RUN_DB_INTEGRATION_TESTS=true with a dedicated TEST_DATABASE_URL.",
}, async (t) => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required for database integration tests.");
    const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
    if (!/(?:^|_)(?:test|integration)(?:_|$)/i.test(databaseName)) {
        throw new Error("Integration tests refuse to use a database whose name does not contain 'test' or 'integration'.");
    }

    process.env.DATABASE_URL = testDatabaseUrl;
    process.env.NODE_ENV = "test";
    process.env.ACCESS_TOKEN_SECRET = "integration-access-secret-with-at-least-32-characters";
    process.env.REFRESH_TOKEN_SECRET = "integration-refresh-secret-with-at-least-32-characters";
    process.env.EXPOSE_AUTH_TOKENS_IN_RESPONSE = "true";
    process.env.RATE_LIMIT_STORE = "memory";

    const [{ default: bcrypt }, { default: prisma }, { app }, customerAuth] = await Promise.all([
        import("bcrypt"),
        import("../src/db/prisma.js"),
        import("../src/app.js"),
        import("../src/services/customerAuth.service.js"),
    ]);
    const suffix = `${process.pid}-${Date.now()}`;
    const sharedEmail = `tenant-auth-${suffix}@example.test`;
    const customerIds = [];
    const organizationIds = [];
    let server;

    t.after(async () => {
        if (server) await new Promise((resolve) => server.close(resolve));
        if (customerIds.length) {
            await prisma.systemLog.deleteMany({
                where: { actorRole: "CUSTOMER", actorId: { in: customerIds } },
            });
            await prisma.customer.deleteMany({ where: { id: { in: customerIds } } });
        }
        if (organizationIds.length) {
            await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
        }
        await prisma.$disconnect();
    });

    const [organizationA, organizationB] = await prisma.$transaction([
        prisma.organization.create({ data: { name: `Tenant A ${suffix}`, alias: `TA${suffix}`, isActive: true } }),
        prisma.organization.create({ data: { name: `Tenant B ${suffix}`, alias: `TB${suffix}`, isActive: true } }),
    ]);
    organizationIds.push(organizationA.id, organizationB.id);
    const [passwordA, passwordB] = await Promise.all([
        bcrypt.hash("TenantPasswordA123!", 10),
        bcrypt.hash("TenantPasswordB123!", 10),
    ]);
    const [customerA, customerB] = await prisma.$transaction([
        prisma.customer.create({
            data: {
                organizationId: organizationA.id,
                companyName: `Customer A ${suffix}`,
                customerCode: `CA${suffix}`,
                email: sharedEmail,
                password: passwordA,
                role: "CUSTOMER",
                isActive: true,
                isLocked: false,
            },
        }),
        prisma.customer.create({
            data: {
                organizationId: organizationB.id,
                companyName: `Customer B ${suffix}`,
                customerCode: `CB${suffix}`,
                email: sharedEmail,
                password: passwordB,
                role: "CUSTOMER",
                isActive: true,
                isLocked: false,
            },
        }),
    ]);
    customerIds.push(customerA.id, customerB.id);
    await prisma.$transaction([
        prisma.rmaRequest.create({
            data: {
                organizationId: organizationA.id,
                customerId: customerA.id,
                sku: "TENANT-A-SKU",
                productName: "Tenant A Device",
                serialNumber: `TENANT-A-${suffix}`,
                productFault: "Tenant A fault",
            },
        }),
        prisma.rmaRequest.create({
            data: {
                organizationId: organizationB.id,
                customerId: customerB.id,
                sku: "TENANT-B-SKU",
                productName: "Tenant B Device",
                serialNumber: `TENANT-B-${suffix}`,
                productFault: "Tenant B fault",
            },
        }),
    ]);

    server = await new Promise((resolve) => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const request = async (path, options = {}) => {
        const response = await fetch(`${baseUrl}${path}`, options);
        const body = await response.json();
        return { status: response.status, body };
    };
    const login = (organizationId, password) => request("/api/v1/customers/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, email: sharedEmail, password }),
    });

    const missingTenant = await request("/api/v1/customers/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: sharedEmail, password: "TenantPasswordA123!" }),
    });
    assert.equal(missingTenant.status, 400);

    const wrongTenantPassword = await login(organizationA.id, "TenantPasswordB123!");
    assert.equal(wrongTenantPassword.status, 401);
    assert.equal(wrongTenantPassword.body.message, "Invalid organization, email, or password.");
    const failedCounts = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, failedLoginAttempts: true },
    });
    assert.equal(failedCounts.find((row) => row.id === customerA.id).failedLoginAttempts, 1);
    assert.equal(failedCounts.find((row) => row.id === customerB.id).failedLoginAttempts, 0);

    const tenantALogin = await login(organizationA.id, "TenantPasswordA123!");
    assert.equal(tenantALogin.status, 200);
    assert.equal(tenantALogin.body.data.user.id, customerA.id);
    assert.equal(tenantALogin.body.data.user.organizationId, organizationA.id);
    assert.ok(tenantALogin.body.data.accessToken);

    const tenantBLogin = await login(organizationB.id, "TenantPasswordB123!");
    assert.equal(tenantBLogin.status, 200);
    assert.equal(tenantBLogin.body.data.user.id, customerB.id);
    assert.equal(tenantBLogin.body.data.user.organizationId, organizationB.id);

    const tenantARequests = await request("/api/v1/repairjobs/requests?page=1&limit=20", {
        headers: { authorization: `Bearer ${tenantALogin.body.data.accessToken}` },
    });
    assert.equal(tenantARequests.status, 200);
    assert.equal(tenantARequests.body.data.total, 1);
    assert.equal(tenantARequests.body.data.requests[0].customerId, customerA.id);
    assert.equal(tenantARequests.body.data.requests[0].organizationId, organizationA.id);

    const refreshed = await request("/api/v1/sessions/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: tenantBLogin.body.data.refreshToken }),
    });
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.body.data.user.id, customerB.id);
    assert.equal(refreshed.body.data.user.organizationId, organizationB.id);

    let resetRecipient;
    await customerAuth.requestCustomerPasswordReset({
        organizationId: organizationA.id,
        email: sharedEmail,
    }, {
        sendEmail: async ({ to }) => {
            resetRecipient = to;
            return { accepted: true };
        },
    });
    assert.equal(resetRecipient, sharedEmail);
    const resetTargets = await prisma.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, passwordResetToken: true },
    });
    assert.ok(resetTargets.find((row) => row.id === customerA.id).passwordResetToken);
    assert.equal(resetTargets.find((row) => row.id === customerB.id).passwordResetToken, null);
});
