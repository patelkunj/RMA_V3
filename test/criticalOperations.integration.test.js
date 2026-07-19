import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const integrationEnabled = process.env.RUN_DB_INTEGRATION_TESTS === "true";

const requireDedicatedTestDatabase = () => {
    const testDatabaseUrl = process.env.TEST_DATABASE_URL;
    if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required for database integration tests.");
    const databaseName = new URL(testDatabaseUrl).pathname.replace(/^\//, "");
    if (!/(?:^|_)(?:test|integration)(?:_|$)/i.test(databaseName)) {
        throw new Error("Integration tests refuse to use a database whose name does not contain 'test' or 'integration'.");
    }
    return testDatabaseUrl;
};

test("critical production operations remain transactional and tenant scoped", {
    skip: integrationEnabled ? false : "Set RUN_DB_INTEGRATION_TESTS=true with a dedicated TEST_DATABASE_URL.",
}, async (t) => {
    process.env.DATABASE_URL = requireDedicatedTestDatabase();
    process.env.NODE_ENV = "test";
    process.env.UPLOAD_STORAGE_PROVIDER = "local";
    process.env.WEBHOOK_ENCRYPTION_KEY = "integration-webhook-encryption-key-with-sufficient-entropy";
    process.env.REQUIRE_QA_BEFORE_COMPLETION = "true";
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "rma-private-integration-"));
    process.env.LOCAL_PRIVATE_UPLOAD_ROOT = storageRoot;

    const [
        { default: prisma },
        billing,
        inventory,
        workflow,
        access,
        uploadUtils,
        documents,
        objectStorage,
        outbox,
        encryption,
        serialNumbers,
    ] = await Promise.all([
        import("../src/db/prisma.js"),
        import("../src/services/billing.service.js"),
        import("../src/services/inventory.service.js"),
        import("../src/services/repairworkflow.service.js"),
        import("../src/utils/accessControl.js"),
        import("../src/utils/fileUpload.js"),
        import("../src/services/document.service.js"),
        import("../src/services/objectStorage.service.js"),
        import("../src/services/outbox.service.js"),
        import("../src/utils/encryption.js"),
        import("../src/services/serialnumber.service.js"),
    ]);

    const suffix = `${process.pid}-${Date.now()}`;
    const ids = {
        organizations: [],
        users: [],
        customers: [],
        jobs: [],
        documents: [],
        productSerials: [],
        products: [],
        objects: [],
    };

    t.after(async () => {
        if (ids.documents.length) await prisma.document.deleteMany({ where: { id: { in: ids.documents } } });
        if (ids.productSerials.length) await prisma.productSerial.deleteMany({ where: { id: { in: ids.productSerials } } });
        if (ids.products.length) await prisma.product.deleteMany({ where: { id: { in: ids.products } } });
        if (ids.organizations.length) {
            await prisma.invoice.deleteMany({ where: { organizationId: { in: ids.organizations } } });
            await prisma.outboxEvent.deleteMany({ where: { organizationId: { in: ids.organizations } } });
            await prisma.notification.deleteMany({ where: { organizationId: { in: ids.organizations } } });
        }
        if (ids.jobs.length) await prisma.repairJob.deleteMany({ where: { id: { in: ids.jobs } } });
        if (ids.customers.length) await prisma.customer.deleteMany({ where: { id: { in: ids.customers } } });
        if (ids.users.length) {
            await prisma.systemLog.deleteMany({ where: { actorId: { in: ids.users } } });
            await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
        }
        if (ids.organizations.length) await prisma.organization.deleteMany({ where: { id: { in: ids.organizations } } });
        for (const key of ids.objects) await objectStorage.deletePrivateObject(key).catch(() => {});
        await prisma.$disconnect();
        await fs.rm(storageRoot, { recursive: true, force: true });
    });

    const [organizationA, organizationB] = await prisma.$transaction([
        prisma.organization.create({ data: { name: `Critical Tenant A ${suffix}`, alias: `CTA${suffix}`, isActive: true } }),
        prisma.organization.create({ data: { name: `Critical Tenant B ${suffix}`, alias: `CTB${suffix}`, isActive: true } }),
    ]);
    ids.organizations.push(organizationA.id, organizationB.id);
    const [adminA, adminB] = await prisma.$transaction([
        prisma.user.create({ data: { firstName: "Admin", lastName: "A", email: `admin-a-${suffix}@example.test`, password: "unused", role: "ADMIN", isActive: true } }),
        prisma.user.create({ data: { firstName: "Admin", lastName: "B", email: `admin-b-${suffix}@example.test`, password: "unused", role: "ADMIN", isActive: true } }),
    ]);
    ids.users.push(adminA.id, adminB.id);
    const [customerA, customerB] = await prisma.$transaction([
        prisma.customer.create({ data: { organizationId: organizationA.id, companyName: "Customer A", customerCode: `CA${suffix}`, email: `customer-a-${suffix}@example.test`, password: "unused", isActive: true } }),
        prisma.customer.create({ data: { organizationId: organizationB.id, companyName: "Customer B", customerCode: `CB${suffix}`, email: `customer-b-${suffix}@example.test`, password: "unused", isActive: true } }),
    ]);
    ids.customers.push(customerA.id, customerB.id);
    await prisma.$transaction([
        prisma.userOrganization.create({ data: { userId: adminA.id, organizationId: organizationA.id } }),
        prisma.userOrganization.create({ data: { userId: adminB.id, organizationId: organizationB.id } }),
        prisma.userCustomer.create({ data: { userId: adminA.id, customerId: customerA.id } }),
        prisma.userCustomer.create({ data: { userId: adminB.id, customerId: customerB.id } }),
        prisma.organizationSetting.create({ data: { organizationId: organizationA.id, taxRate: "0.15", nextInvoiceNumber: 1 } }),
    ]);

    const makeJob = (organizationId, customerId, createdBy, label) => prisma.repairJob.create({
        data: {
            raJobId: `${label}-${suffix}`,
            organizationId,
            customerId,
            sku: `${label}-SKU`,
            productName: `${label} Product`,
            serialNumber: `${label}-SERIAL-${suffix}`,
            productFault: "Integration test fault",
            createdBy,
            createdRoleBy: "ADMIN",
        },
    });
    const [billingJob, workflowJob, tenantBJob] = await Promise.all([
        makeJob(organizationA.id, customerA.id, adminA.id, "BILLING"),
        makeJob(organizationA.id, customerA.id, adminA.id, "WORKFLOW"),
        makeJob(organizationB.id, customerB.id, adminB.id, "TENANT-B"),
    ]);
    ids.jobs.push(billingJob.id, workflowJob.id, tenantBJob.id);
    const requestA = { user: { ...adminA, role: "ADMIN" } };
    const requestB = { user: { ...adminB, role: "ADMIN" } };

    const invokeController = (handler, req) => new Promise((resolve, reject) => {
        const res = {
            statusCode: 200,
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(body) {
                resolve({ status: this.statusCode, body });
            },
        };
        handler(req, res, reject);
    });

    await t.test("billing uses decimal-safe totals and serializes concurrent payments", async () => {
        await prisma.repairJobCosting.create({
            data: {
                repairJobId: billingJob.id,
                costType: "LABOR",
                quantity: 3,
                unitCost: "0.10",
                totalCost: "0.30",
                billableToCustomer: true,
                customerCharge: "0.30",
            },
        });
        const invoice = await billing.createInvoice(requestA, billingJob.id);
        assert.equal(invoice.subtotal.toFixed(2), "0.30");
        assert.equal(invoice.tax.toFixed(2), "0.05");
        assert.equal(invoice.total.toFixed(2), "0.35");

        await billing.recordPayment(requestA, invoice.id, { amount: "0.10", method: "TEST", externalRef: `PAY-1-${suffix}` });
        const concurrent = await Promise.allSettled([
            billing.recordPayment(requestA, invoice.id, { amount: "0.25", method: "TEST", externalRef: `PAY-2-${suffix}` }),
            billing.recordPayment(requestA, invoice.id, { amount: "0.25", method: "TEST", externalRef: `PAY-3-${suffix}` }),
        ]);
        assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);
        const paid = await prisma.invoice.findUnique({ where: { id: invoice.id } });
        assert.equal(paid.amountPaid.toFixed(2), "0.35");
        assert.equal(paid.status, "PAID");
    });

    await t.test("inventory row locks prevent over-reservation", async () => {
        const item = await inventory.createInventoryItem(requestA, {
            organizationId: organizationA.id,
            sku: `LOCK-${suffix}`,
            name: "Locking Test Item",
            quantityOnHand: 1,
            unitCost: "0.10",
        });
        const attempts = await Promise.allSettled([
            inventory.recordMovement(requestA, item.id, { type: "RESERVE", quantity: 1, reason: "Concurrent A" }),
            inventory.recordMovement(requestA, item.id, { type: "RESERVE", quantity: 1, reason: "Concurrent B" }),
        ]);
        assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
        const stored = await prisma.inventoryItem.findUnique({ where: { id: item.id }, include: { movements: true } });
        assert.equal(stored.quantityReserved, 1);
        assert.equal(stored.movements.length, 1);
    });

    await t.test("repair status transitions enforce the state machine and QA gate", async () => {
        await assert.rejects(() => workflow.transitionRepairJob(requestA, workflowJob.id, "COMPLETED"), /cannot move/);
        assert.equal((await workflow.transitionRepairJob(requestA, workflowJob.id, "RECEIVED")).jobStatus, "RECEIVED");
        assert.equal((await workflow.transitionRepairJob(requestA, workflowJob.id, "IN_PROGRESS")).jobStatus, "IN_PROGRESS");
        await assert.rejects(() => workflow.transitionRepairJob(requestA, workflowJob.id, "COMPLETED"), /passing QA/);
        await workflow.addWorkLog(requestA, workflowJob.id, { type: "QA", summary: "Production QA", passed: true });
        assert.equal((await workflow.transitionRepairJob(requestA, workflowJob.id, "COMPLETED")).jobStatus, "COMPLETED");
        const tracking = await prisma.repairJobTracking.findMany({ where: { repairJobId: workflowJob.id }, orderBy: { id: "asc" } });
        assert.deepEqual(tracking.map((row) => row.status), ["RECEIVED", "IN_PROGRESS", "COMPLETED"]);
    });

    await t.test("private uploads round-trip through storage and remain tenant protected", async () => {
        const tempFile = path.join(storageRoot, `source-${suffix}.pdf`);
        const contents = Buffer.from("%PDF-1.4\n% integration upload\n");
        await fs.writeFile(tempFile, contents);
        const [stored] = await uploadUtils.storeUploadedFiles([{
            path: tempFile,
            filename: `evidence-${suffix}.pdf`,
            mimetype: "application/pdf",
        }], billingJob.id, "documents");
        ids.objects.push(stored.key);
        const document = await prisma.document.create({
            data: {
                repairJobId: billingJob.id,
                relatedType: "repair_job",
                relatedId: billingJob.id,
                documentName: stored.name,
                documentUrl: stored.reference,
                documentType: "PDF",
                uploadedBy: adminA.id,
                uploadedRole: "ADMIN",
                fileHash: stored.hash,
            },
        });
        ids.documents.push(document.id);
        const downloaded = await documents.resolveDocumentDownload(requestA, document.id);
        assert.deepEqual(downloaded.buffer, contents);
        await assert.rejects(() => documents.resolveDocumentDownload(requestB, document.id), /Document|Repair job not found/);
    });

    await t.test("tenant permissions hide another organization's repair jobs", async () => {
        await assert.rejects(() => access.ensureRepairJobAccess(requestA, tenantBJob.id), (error) => error.statusCode === 404);
        await assert.rejects(
            () => inventory.createInventoryItem(requestA, { organizationId: organizationB.id, sku: `DENIED-${suffix}`, name: "Denied" }),
            (error) => error.statusCode === 403,
        );

        const [productA, productB] = await prisma.$transaction([
            prisma.product.create({ data: { organizationId: organizationA.id, sku: `SERIAL-A-${suffix}`, name: "Tenant A product" } }),
            prisma.product.create({ data: { organizationId: organizationB.id, sku: `SERIAL-B-${suffix}`, name: "Tenant B product" } }),
        ]);
        ids.products.push(productA.id, productB.id);
        const protectedSerial = await prisma.productSerial.create({
            data: {
                organizationId: organizationB.id,
                productId: productB.id,
                serialNumber: `PROTECTED-${suffix}`,
                salesInvoice: `INV-B-${suffix}`,
                saleDate: new Date("2026-01-01T00:00:00.000Z"),
                warrantyExpiry: new Date("2027-01-01T00:00:00.000Z"),
            },
        });
        ids.productSerials.push(protectedSerial.id);

        const attemptedMove = await invokeController(serialNumbers.updateSerialNumber, {
            ...requestA,
            params: { id: String(protectedSerial.id) },
            body: {
                organizationId: organizationA.id,
                productId: productA.id,
                serialNumber: `STOLEN-${suffix}`,
                salesInvoice: `INV-A-${suffix}`,
                saleDate: "2026-02-01",
                warrantyExpiry: "2027-02-01",
            },
        });
        assert.equal(attemptedMove.status, 404);
        const unchangedSerial = await prisma.productSerial.findUnique({ where: { id: protectedSerial.id } });
        assert.equal(unchangedSerial.organizationId, organizationB.id);
        assert.equal(unchangedSerial.serialNumber, `PROTECTED-${suffix}`);
    });

    await t.test("outbox retries only failed webhook deliveries", async () => {
        await prisma.outboxEvent.updateMany({ where: { organizationId: organizationA.id }, data: { status: "SENT", processedAt: new Date() } });
        const secretCiphertext = encryption.encryptSecret("integration-webhook-secret");
        const [alwaysSucceeds, failsOnce] = await prisma.$transaction([
            prisma.webhookEndpoint.create({ data: { organizationId: organizationA.id, url: "https://success.example.test/hook", secretCiphertext, events: ["integration.retry"], createdBy: adminA.id } }),
            prisma.webhookEndpoint.create({ data: { organizationId: organizationA.id, url: "https://retry.example.test/hook", secretCiphertext, events: ["integration.retry"], createdBy: adminA.id } }),
        ]);
        const event = await prisma.outboxEvent.create({ data: { organizationId: organizationA.id, eventType: "integration.retry", aggregateType: "Test", aggregateId: suffix, payload: { safe: true } } });
        const calls = new Map();
        const fetchImpl = async (url) => {
            calls.set(url, (calls.get(url) || 0) + 1);
            const isFirstRetryCall = url.includes("retry.example.test") && calls.get(url) === 1;
            return { ok: !isFirstRetryCall, status: isFirstRetryCall ? 503 : 200 };
        };
        const firstAttemptAt = new Date(Date.now() + 1_000);
        await outbox.processOutboxBatch({ limit: 20, fetchImpl, now: firstAttemptAt });
        let eventState = await prisma.outboxEvent.findUnique({ where: { id: event.id }, include: { deliveries: true } });
        assert.equal(eventState.status, "FAILED");
        assert.deepEqual(eventState.deliveries.map((delivery) => delivery.status).sort(), ["FAILED", "SENT"]);
        assert.equal(calls.get(alwaysSucceeds.url), 1);
        assert.equal(calls.get(failsOnce.url), 1);

        await outbox.processOutboxBatch({ limit: 20, fetchImpl, now: new Date(firstAttemptAt.getTime() + 3 * 60_000) });
        eventState = await prisma.outboxEvent.findUnique({ where: { id: event.id }, include: { deliveries: true } });
        assert.equal(eventState.status, "SENT");
        assert.equal(calls.get(alwaysSucceeds.url), 1);
        assert.equal(calls.get(failsOnce.url), 2);
        assert.deepEqual(eventState.deliveries.map((delivery) => delivery.attempts).sort(), [1, 2]);
    });
});
