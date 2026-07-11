import test from "node:test";
import assert from "node:assert/strict";
import {
    accountActivationEmail,
    billingInvoiceEmail,
    passwordResetEmail,
    repairJobStatusEmail,
} from "../src/templates/email.templates.js";

test("account activation template includes a safe activation link and expiry", () => {
    const html = accountActivationEmail({
        name: "Ava <Admin>",
        activationUrl: "https://portal.example.test/activate/token-123",
    });

    assert.match(html, /Activate your account/);
    assert.match(html, /token-123/);
    assert.match(html, /24 hours/);
    assert.doesNotMatch(html, /Ava <Admin>/);
    assert.match(html, /Ava &lt;Admin&gt;/);
});

test("password reset template explains expiry and unexpected requests", () => {
    const html = passwordResetEmail({
        name: "Customer",
        resetUrl: "https://portal.example.test/reset/token-456",
    });

    assert.match(html, /Reset your password/);
    assert.match(html, /30 minutes/);
    assert.match(html, /did not request a reset/);
});

test("repair status template presents job, product, and formatted status", () => {
    const html = repairJobStatusEmail({
        customerName: "Example Customer",
        jobNumber: "RMA-100",
        productName: "Camera",
        status: "WAITING_PARTS",
        statusUrl: "https://portal.example.test/repair-jobs/100",
    });

    assert.match(html, /RMA-100/);
    assert.match(html, /Camera/);
    assert.match(html, /Waiting Parts/);
});

test("billing template states that the invoice PDF is attached", () => {
    const html = billingInvoiceEmail({
        customerName: "Example Customer",
        invoiceNumber: "INV-100",
        jobNumber: "RMA-100",
        total: "NZ$115.00",
        dueDate: "2026-08-10",
    });

    assert.match(html, /invoice attached as a PDF/i);
    assert.match(html, /INV-100/);
    assert.match(html, /NZ\$115\.00/);
});
