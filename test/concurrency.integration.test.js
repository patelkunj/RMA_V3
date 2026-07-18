import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const integrationEnabled = process.env.RUN_DB_INTEGRATION_TESTS === "true";

const dedicatedTestDatabaseUrl = () => {
    const value = process.env.TEST_DATABASE_URL;
    if (!value) throw new Error("TEST_DATABASE_URL is required for database integration tests.");
    const databaseName = new URL(value).pathname.replace(/^\//, "");
    if (!/(?:^|_)(?:test|integration)(?:_|$)/i.test(databaseName)) {
        throw new Error("Concurrency tests refuse to use a database whose name does not contain 'test' or 'integration'.");
    }
    return value;
};

const fulfilled = (results) => results.filter((result) => result.status === "fulfilled");
const rejected = (results) => results.filter((result) => result.status === "rejected");

const assertSingleWinner = (results, label) => {
    assert.equal(fulfilled(results).length, 1, `${label} must have exactly one successful request`);
    assert.equal(rejected(results).length, results.length - 1, `${label} must reject every competing request`);
    for (const result of rejected(results)) {
        assert.ok([401, 409].includes(result.reason?.statusCode), `${label} must fail with a safe conflict response`);
    }
};

test("critical business mutations remain correct under concurrent PostgreSQL requests", {
    skip: integrationEnabled ? false : "Set RUN_DB_INTEGRATION_TESTS=true with a dedicated TEST_DATABASE_URL.",
    timeout: 120_000,
}, async (t) => {
    process.env.DATABASE_URL = dedicatedTestDatabaseUrl();
    process.env.NODE_ENV = "test";
    process.env.REQUIRE_QA_BEFORE_COMPLETION = "false";
    process.env.MFA_ENCRYPTION_KEY = "integration-mfa-encryption-key-with-sufficient-entropy";

    const [
        { default: prisma },
        billing,
        workflow,
        mfa,
        sla,
        { hashToken },
    ] = await Promise.all([
        import("../src/db/prisma.js"),
        import("../src/services/billing.service.js"),
        import("../src/services/repairworkflow.service.js"),
        import("../src/services/mfa.service.js"),
        import("../src/services/sla.service.js"),
        import("../src/utils/tokenSecurity.js"),
    ]);

    const suffix = `${process.pid}-${Date.now()}`;
    let organization;
    let admin;
    let customer;

    t.after(async () => {
        if (organization) {
            await prisma.invoice.deleteMany({ where: { organizationId: organization.id } });
            await prisma.notification.deleteMany({ where: { organizationId: organization.id } });
            await prisma.outboxEvent.deleteMany({ where: { organizationId: organization.id } });
            await prisma.rmaRequest.deleteMany({ where: { organizationId: organization.id } });
            await prisma.repairJob.deleteMany({ where: { organizationId: organization.id } });
        }
        if (admin) {
            await prisma.userCustomer.deleteMany({ where: { userId: admin.id } });
            await prisma.userOrganization.deleteMany({ where: { userId: admin.id } });
        }
        if (organization) {
            await prisma.organizationSetting.deleteMany({ where: { organizationId: organization.id } });
        }
        if (customer) await prisma.customer.deleteMany({ where: { id: customer.id } });
        if (admin) await prisma.user.deleteMany({ where: { id: admin.id } });
        if (organization) await prisma.organization.deleteMany({ where: { id: organization.id } });
        await prisma.$disconnect();
    });

    organization = await prisma.organization.create({
        data: { name: `Concurrency Organization ${suffix}`, alias: `CON${suffix}`, isActive: true },
    });
    admin = await prisma.user.create({
        data: {
            firstName: "Concurrency",
            lastName: "Admin",
            email: `concurrency-admin-${suffix}@example.test`,
            password: "unused",
            role: "ADMIN",
            isActive: true,
        },
    });
    customer = await prisma.customer.create({
        data: {
            organizationId: organization.id,
            companyName: `Concurrency Customer ${suffix}`,
            customerCode: `CC${suffix}`,
            email: `concurrency-customer-${suffix}@example.test`,
            password: "unused",
            isActive: true,
        },
    });
    await prisma.$transaction([
        prisma.userOrganization.create({ data: { userId: admin.id, organizationId: organization.id } }),
        prisma.userCustomer.create({ data: { userId: admin.id, customerId: customer.id } }),
        prisma.organizationSetting.create({
            data: { organizationId: organization.id, taxRate: "0.15", currency: "NZD", nextInvoiceNumber: 1 },
        }),
    ]);

    const adminRequest = { user: { id: admin.id, email: admin.email, role: "ADMIN" } };
    const customerRequest = {
        customer: {
            id: customer.id,
            email: customer.email,
            role: "CUSTOMER",
            organizationId: organization.id,
        },
    };

    const createJob = async (label, overrides = {}) => {
        const job = await prisma.repairJob.create({
            data: {
                raJobId: `${label}-${suffix}`,
                organizationId: organization.id,
                customerId: customer.id,
                sku: `${label}-SKU`,
                productName: `${label} Product`,
                serialNumber: `${label}-SERIAL-${suffix}`,
                productFault: "Concurrency test fault",
                createdBy: admin.id,
                createdRoleBy: "ADMIN",
                ...overrides,
            },
        });
        return job;
    };

    const addBillableCost = (repairJobId, amount = "10.00") => prisma.repairJobCosting.create({
        data: {
            repairJobId,
            costType: "LABOR",
            quantity: 1,
            unitCost: amount,
            totalCost: amount,
            billableToCustomer: true,
            customerCharge: amount,
        },
    });

    const runBehindRowLock = async (table, id, expectedWaiters, startContenders) => {
        const allowedTables = new Set([
            "Customer",
            "Invoice",
            "OrganizationSetting",
            "RepairEstimate",
            "RepairJob",
            "RmaRequest",
            "User",
        ]);
        if (!allowedTables.has(table)) throw new Error(`Unsupported concurrency-test table: ${table}`);

        let releaseLock;
        let signalLocked;
        let lockTransaction;
        const release = new Promise((resolve) => { releaseLock = resolve; });
        const locked = new Promise((resolve) => { signalLocked = resolve; });
        const blocker = prisma.$transaction(async (tx) => {
            lockTransaction = tx;
            await tx.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id" = $1 FOR UPDATE`, Number(id));
            signalLocked();
            await release;
        }, { timeout: 10_000 });
        await Promise.race([locked, blocker]);

        let contenders;
        try {
            contenders = Promise.resolve(startContenders());
            const queryPattern = `%"${table}"%`;
            const deadline = Date.now() + 5_000;
            let waiterCount = 0;
            while (Date.now() < deadline) {
                const rows = await lockTransaction.$queryRaw`
                    SELECT COUNT(*)::integer AS "count"
                    FROM pg_stat_activity
                    WHERE datname = current_database()
                      AND pid <> pg_backend_pid()
                      AND wait_event_type = 'Lock'
                      AND query LIKE ${queryPattern}
                `;
                waiterCount = Number(rows[0]?.count || 0);
                if (waiterCount >= expectedWaiters) break;
                await delay(25);
            }
            assert.ok(
                waiterCount >= expectedWaiters,
                `Expected ${expectedWaiters} concurrent ${table} lock waiters, observed ${waiterCount}.`,
            );
        } finally {
            releaseLock();
            await blocker;
        }
        return contenders;
    };

    await t.test("one repair job cannot receive two active invoices", async () => {
        const job = await createJob("INVOICE-RACE");
        await addBillableCost(job.id);
        const attempts = await runBehindRowLock("RepairJob", job.id, 2, () => Promise.allSettled([
            billing.createInvoice(adminRequest, job.id),
            billing.createInvoice(adminRequest, job.id),
        ]));

        assertSingleWinner(attempts, "concurrent invoice creation");
        const invoices = await prisma.invoice.findMany({ where: { repairJobId: job.id, status: { not: "VOID" } } });
        assert.equal(invoices.length, 1);
        assert.equal(await prisma.outboxEvent.count({
            where: { aggregateType: "Invoice", aggregateId: String(invoices[0].id) },
        }), 1);
    });

    await t.test("different repair jobs receive unique invoice numbers concurrently", async () => {
        const [jobA, jobB] = await Promise.all([createJob("SEQUENCE-A"), createJob("SEQUENCE-B")]);
        await Promise.all([addBillableCost(jobA.id), addBillableCost(jobB.id)]);
        const settings = await prisma.organizationSetting.findUnique({ where: { organizationId: organization.id } });
        const invoices = await runBehindRowLock("OrganizationSetting", settings.id, 2, () => Promise.all([
            billing.createInvoice(adminRequest, jobA.id),
            billing.createInvoice(adminRequest, jobB.id),
        ]));
        assert.equal(new Set(invoices.map((invoice) => invoice.invoiceNumber)).size, 2);
    });

    await t.test("each winner-agnostic race operation succeeds on its own", async () => {
        const voidJob = await createJob("VOID-SUCCESS");
        await addBillableCost(voidJob.id);
        const invoice = await billing.createInvoice(adminRequest, voidJob.id);
        assert.equal((await billing.voidInvoice(adminRequest, invoice.id, "Independent void path")).status, "VOID");

        const createRequest = (label) => prisma.rmaRequest.create({
            data: {
                organizationId: organization.id,
                customerId: customer.id,
                sku: `${label}-SKU`,
                productName: `${label} Product`,
                serialNumber: `${label}-${suffix}`,
                productFault: "Independent decision path",
            },
        });
        const acceptedRequest = await createRequest("RMA-ACCEPT");
        const accepted = await workflow.reviewRmaRequest(adminRequest, acceptedRequest.id, "ACCEPTED", "Accept path");
        assert.equal(accepted.request.status, "ACCEPTED");
        assert.ok(accepted.repairJob?.id);
        const rejectedRequest = await createRequest("RMA-REJECT");
        const declined = await workflow.reviewRmaRequest(adminRequest, rejectedRequest.id, "REJECTED", "Reject path");
        assert.equal(declined.request.status, "REJECTED");
        assert.equal(declined.repairJob, null);

        const estimatePayload = { send: true, lines: [{ description: "Independent repair", quantity: 1, unitPrice: "8.75" }] };
        const approvalJob = await createJob("ESTIMATE-APPROVE");
        const approvalEstimate = await workflow.createEstimate(adminRequest, approvalJob.id, estimatePayload);
        assert.equal((await workflow.decideEstimate(customerRequest, approvalEstimate.id, "APPROVED", "Approve path")).status, "APPROVED");
        const rejectionJob = await createJob("ESTIMATE-REJECT");
        const rejectionEstimate = await workflow.createEstimate(adminRequest, rejectionJob.id, estimatePayload);
        assert.equal((await workflow.decideEstimate(customerRequest, rejectionEstimate.id, "REJECTED", "Reject path")).status, "REJECTED");
    });

    await t.test("payment and void cannot both win for the same invoice", async () => {
        const job = await createJob("PAYMENT-VOID");
        await addBillableCost(job.id, "20.00");
        const invoice = await billing.createInvoice(adminRequest, job.id);
        const attempts = await runBehindRowLock("Invoice", invoice.id, 2, () => Promise.allSettled([
            billing.recordPayment(adminRequest, invoice.id, {
                amount: invoice.total.toFixed(2),
                method: "TEST",
                externalRef: `PAYMENT-VOID-${suffix}`,
            }),
            billing.voidInvoice(adminRequest, invoice.id, "Concurrent void test"),
        ]));

        assertSingleWinner(attempts, "payment versus void");
        const stored = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true } });
        if (stored.status === "VOID") {
            assert.equal(stored.payments.length, 0);
            assert.equal(stored.amountPaid.toFixed(2), "0.00");
        } else {
            assert.equal(stored.status, "PAID");
            assert.equal(stored.amountPaid.toFixed(2), stored.total.toFixed(2));
            assert.equal(stored.payments.length, 1);
        }
    });

    await t.test("a duplicate external payment reference changes the balance once", async () => {
        const job = await createJob("PAYMENT-REFERENCE");
        await addBillableCost(job.id, "30.00");
        const invoice = await billing.createInvoice(adminRequest, job.id);
        const payment = {
            amount: "5.00",
            method: "TEST",
            externalRef: `DUPLICATE-PAYMENT-${suffix}`,
        };
        const attempts = await runBehindRowLock("Invoice", invoice.id, 2, () => Promise.allSettled([
            billing.recordPayment(adminRequest, invoice.id, payment),
            billing.recordPayment(adminRequest, invoice.id, payment),
        ]));
        assertSingleWinner(attempts, "duplicate payment reference");
        const stored = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { payments: true } });
        assert.equal(stored.amountPaid.toFixed(2), "5.00");
        assert.equal(stored.payments.length, 1);
        assert.equal(stored.payments[0].externalRef, payment.externalRef);
    });

    await t.test("an MFA recovery code is consumed exactly once", async () => {
        const recoveryCode = `RECOVERY-${suffix}`;
        const recoveryHash = hashToken(recoveryCode);
        await prisma.user.update({
            where: { id: admin.id },
            data: { mfaEnabled: true, mfaRecoveryCodeHashes: [recoveryHash] },
        });
        const actor = { ...adminRequest.user, mfaEnabled: true, mfaSecretCiphertext: null, mfaRecoveryCodeHashes: [recoveryHash] };
        const attempts = await runBehindRowLock("User", admin.id, 2, () => Promise.allSettled([
            mfa.verifyLoginMfa(actor, recoveryCode),
            mfa.verifyLoginMfa(actor, recoveryCode),
        ]));

        assertSingleWinner(attempts, "MFA recovery-code consumption");
        const stored = await prisma.user.findUnique({ where: { id: admin.id }, select: { mfaRecoveryCodeHashes: true } });
        assert.deepEqual(stored.mfaRecoveryCodeHashes, []);
    });

    await t.test("a customer MFA recovery code is consumed exactly once", async () => {
        const recoveryCode = `CUSTOMER-RECOVERY-${suffix}`;
        const recoveryHash = hashToken(recoveryCode);
        await prisma.customer.update({
            where: { id: customer.id },
            data: { mfaEnabled: true, mfaRecoveryCodeHashes: [recoveryHash] },
        });
        const actor = {
            ...customerRequest.customer,
            mfaEnabled: true,
            mfaSecretCiphertext: null,
            mfaRecoveryCodeHashes: [recoveryHash],
        };
        const attempts = await runBehindRowLock("Customer", customer.id, 2, () => Promise.allSettled([
            mfa.verifyLoginMfa(actor, recoveryCode),
            mfa.verifyLoginMfa(actor, recoveryCode),
        ]));

        assertSingleWinner(attempts, "customer MFA recovery-code consumption");
        const stored = await prisma.customer.findUnique({
            where: { id: customer.id },
            select: { mfaRecoveryCodeHashes: true },
        });
        assert.deepEqual(stored.mfaRecoveryCodeHashes, []);
    });

    await t.test("different MFA recovery codes can be consumed concurrently without reappearing", async () => {
        const recoveryCodes = [`RECOVERY-A-${suffix}`, `RECOVERY-B-${suffix}`];
        const recoveryHashes = recoveryCodes.map(hashToken);
        await prisma.user.update({
            where: { id: admin.id },
            data: { mfaEnabled: true, mfaRecoveryCodeHashes: recoveryHashes },
        });
        const actor = {
            ...adminRequest.user,
            mfaEnabled: true,
            mfaSecretCiphertext: null,
            mfaRecoveryCodeHashes: recoveryHashes,
        };
        const attempts = await runBehindRowLock("User", admin.id, 2, () => Promise.allSettled(
            recoveryCodes.map((code) => mfa.verifyLoginMfa(actor, code)),
        ));
        assert.equal(fulfilled(attempts).length, 2);
        const stored = await prisma.user.findUnique({ where: { id: admin.id }, select: { mfaRecoveryCodeHashes: true } });
        assert.deepEqual(stored.mfaRecoveryCodeHashes, []);
    });

    await t.test("an RMA request can be reviewed only once", async () => {
        const request = await prisma.rmaRequest.create({
            data: {
                organizationId: organization.id,
                customerId: customer.id,
                sku: "RMA-RACE-SKU",
                productName: "RMA Race Product",
                serialNumber: `RMA-RACE-${suffix}`,
                productFault: "Concurrent review",
            },
        });
        const attempts = await runBehindRowLock("RmaRequest", request.id, 2, () => Promise.allSettled([
            workflow.reviewRmaRequest(adminRequest, request.id, "ACCEPTED", "Accepted concurrently"),
            workflow.reviewRmaRequest(adminRequest, request.id, "REJECTED", "Rejected concurrently"),
        ]));

        assertSingleWinner(attempts, "RMA review");
        const stored = await prisma.rmaRequest.findUnique({ where: { id: request.id } });
        assert.ok(["ACCEPTED", "REJECTED"].includes(stored.status));
        const acceptedJobs = await prisma.repairJob.count({ where: { raJobId: `${customer.customerCode}-${String(request.id).padStart(6, "0")}` } });
        assert.equal(acceptedJobs, stored.status === "ACCEPTED" ? 1 : 0);
        assert.equal(await prisma.outboxEvent.count({
            where: { aggregateType: "RmaRequest", aggregateId: String(request.id) },
        }), 1);
    });

    await t.test("estimate versions and customer decisions are serialized", async () => {
        const job = await createJob("ESTIMATE-RACE");
        const payload = { send: true, lines: [{ description: "Repair", quantity: 1, unitPrice: "12.34" }] };
        const estimates = await runBehindRowLock("RepairJob", job.id, 2, () => Promise.all([
            workflow.createEstimate(adminRequest, job.id, payload),
            workflow.createEstimate(adminRequest, job.id, payload),
        ]));
        assert.deepEqual(estimates.map((estimate) => estimate.version).sort((a, b) => a - b), [1, 2]);

        const latest = estimates.find((estimate) => estimate.version === 2);
        const attempts = await runBehindRowLock("RepairEstimate", latest.id, 2, () => Promise.allSettled([
            workflow.decideEstimate(customerRequest, latest.id, "APPROVED", "Approve"),
            workflow.decideEstimate(customerRequest, latest.id, "REJECTED", "Reject"),
        ]));
        assertSingleWinner(attempts, "estimate decision");
        const stored = await prisma.repairEstimate.findUnique({ where: { id: latest.id } });
        assert.ok(["APPROVED", "REJECTED"].includes(stored.status));
        assert.ok(stored.decisionAt instanceof Date);
    });

    await t.test("competing status transitions create one transition side effect set", async () => {
        const job = await createJob("TRANSITION-RACE", { jobStatus: "IN_PROGRESS" });
        const attempts = await runBehindRowLock("RepairJob", job.id, 2, () => Promise.allSettled([
            workflow.transitionRepairJob(adminRequest, job.id, "COMPLETED"),
            workflow.transitionRepairJob(adminRequest, job.id, "CANCELLED"),
        ]));
        assertSingleWinner(attempts, "repair status transition");
        assert.equal(await prisma.repairJobTracking.count({ where: { repairJobId: job.id } }), 1);
        assert.equal(await prisma.repairJobAuditLog.count({ where: { repairJobId: job.id, actionType: "STATUS_CHANGE" } }), 1);
        assert.equal(await prisma.outboxEvent.count({
            where: { aggregateType: "RepairJob", aggregateId: String(job.id), eventType: "repair_job.status_changed" },
        }), 1);
    });

    await t.test("competing SLA workers emit one breach event", async () => {
        const job = await createJob("SLA-RACE", { slaDueAt: new Date(Date.now() - 60_000) });
        const unrelatedBreaches = await prisma.repairJob.count({
            where: {
                id: { not: job.id },
                jobStatus: { in: ["CREATED", "RECEIVED", "IN_PROGRESS"] },
                slaDueAt: { lt: new Date() },
                slaBreachedAt: null,
            },
        });
        assert.equal(unrelatedBreaches, 0, "The dedicated test database must not contain unrelated pending SLA breaches.");
        const attempts = await runBehindRowLock("RepairJob", job.id, 2, () => Promise.allSettled([
            sla.processSlaBreaches(100),
            sla.processSlaBreaches(100),
        ]));
        assert.equal(rejected(attempts).length, 0);
        const stored = await prisma.repairJob.findUnique({ where: { id: job.id } });
        assert.ok(stored.slaBreachedAt instanceof Date);
        assert.equal(await prisma.outboxEvent.count({
            where: { aggregateType: "RepairJob", aggregateId: String(job.id), eventType: "repair_job.sla_breached" },
        }), 1);
    });

    await t.test("an SLA breach claim rolls back when its outbox insert fails", async () => {
        const job = await createJob("SLA-ROLLBACK", { slaDueAt: new Date(Date.now() - 60_000) });
        const triggerName = "test_reject_sla_outbox";
        const functionName = "test_reject_sla_outbox_insert";
        const removeFailureTrigger = async () => {
            await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "OutboxEvent"`);
            await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
        };
        t.after(removeFailureTrigger);
        await removeFailureTrigger();
        await prisma.$executeRawUnsafe(`
            CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
            BEGIN
                IF NEW."eventType" = 'repair_job.sla_breached'
                   AND NEW."aggregateId" = '${job.id}' THEN
                    RAISE EXCEPTION 'forced SLA outbox failure';
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql
        `);
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER "${triggerName}"
            BEFORE INSERT ON "OutboxEvent"
            FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
        `);

        try {
            await assert.rejects(sla.processSlaBreaches(100));
            const stored = await prisma.repairJob.findUnique({ where: { id: job.id } });
            assert.equal(stored.slaBreachedAt, null);
            assert.equal(await prisma.outboxEvent.count({
                where: { eventType: "repair_job.sla_breached", aggregateId: String(job.id) },
            }), 0);
        } finally {
            await removeFailureTrigger();
        }
    });
});
