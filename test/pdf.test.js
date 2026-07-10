import test from "node:test";
import assert from "node:assert/strict";
import {
    createInvoicePdfBuffer,
    createPdfBuffer,
} from "../src/utils/pdf.js";

test("createPdfBuffer creates a valid single-page PDF buffer", async () => {
    const buffer = await createPdfBuffer([
        { text: "Service Report", size: 18 },
        { text: "RA Job: TEST-00001" },
    ]);

    assert.ok(Buffer.isBuffer(buffer));
    assert.match(buffer.subarray(0, 8).toString("utf8"), /^%PDF-1\./);
    assert.match(buffer.toString("utf8"), /%%EOF/);
});

test("createInvoicePdfBuffer creates a valid invoice PDF buffer", async () => {
    const buffer = await createInvoicePdfBuffer({
        invoiceNumber: "RMA-00001",
        issueDate: "2026-07-10",
        dueDate: "2026-07-20",
        organization: { name: "RMA Service", alias: "RS" },
        customer: {
            companyName: "Test Customer",
            contactPersonName: "Ava Tester",
            returnAddress: "123 Test Street",
            email: "customer@example.test",
        },
        items: [
            { description: "Labor", rate: 50, quantity: 2, total: 100 },
        ],
        subtotal: 100,
        tax: 10,
        total: 110,
        paymentInfo: {
            bankName: "Test Bank",
            accountName: "RMA Service",
            accountNumber: "00-0000-0000000-00",
        },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.match(buffer.subarray(0, 8).toString("utf8"), /^%PDF-1\./);
    assert.match(buffer.toString("utf8"), /%%EOF/);
});
