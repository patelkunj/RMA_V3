import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { readTaxRate } from "../config/env.js";
import { enqueueOutbox } from "./outbox.service.js";
import prisma from "../db/prisma.js";
import { calculateTax, divideMoney, money, sumMoney } from "../utils/money.js";

const createInvoice = async (req, repairJobId, payload = {}) => {
    if (!req.user || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
        throw new ApiError(403, "Only administrators can create invoices.");
    }
    const jobAccess = await ensureRepairJobAccess(req, repairJobId);

    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "RepairJob" WHERE "id" = ${jobAccess.id} FOR UPDATE`;
        const existing = await tx.invoice.findFirst({
            where: { repairJobId: jobAccess.id, status: { not: "VOID" } },
            orderBy: { createdDate: "desc" },
        });
        if (existing) throw new ApiError(409, "An active invoice already exists for this repair job.");

        const job = await tx.repairJob.findUnique({
            where: { id: jobAccess.id },
            include: { costings: { include: { product: true }, orderBy: { id: "asc" } }, customer: true },
        });
        if (!job) throw new ApiError(404, "Repair job not found.");
        const settings = await tx.organizationSetting.upsert({
            where: { organizationId: job.organizationId },
            create: {
                organizationId: job.organizationId,
                taxRate: readTaxRate(),
                currency: process.env.INVOICE_CURRENCY || "NZD",
                nextInvoiceNumber: 2,
            },
            update: { nextInvoiceNumber: { increment: 1 } },
        });
        const sequence = settings.nextInvoiceNumber - 1;
        const lines = job.costings
            .filter((cost) => cost.billableToCustomer)
            .map((cost) => ({
                description: [cost.costType.replaceAll("_", " "), cost.product?.sku, cost.product?.name].filter(Boolean).join(" - "),
                quantity: cost.quantity,
                unitPrice: divideMoney(cost.customerCharge, cost.quantity),
                total: money(cost.customerCharge, "customerCharge"),
            }));
        if (!lines.length) throw new ApiError(409, "No billable repair costs are available.");
        const subtotal = sumMoney(lines.map((line) => line.total));
        const tax = calculateTax(subtotal, settings.taxRate);
        const now = new Date();
        const dueAt = new Date(now);
        dueAt.setDate(dueAt.getDate() + Number(job.customer.paymentTerms || 0));
        const issue = payload.issue !== false;

        const invoice = await tx.invoice.create({
            data: {
                organizationId: job.organizationId,
                repairJobId: job.id,
                invoiceNumber: `${now.getUTCFullYear()}-${String(sequence).padStart(6, "0")}`,
                status: issue ? "ISSUED" : "DRAFT",
                currency: settings.currency,
                subtotal,
                tax,
                total: subtotal.plus(tax),
                issuedAt: issue ? now : null,
                dueAt: issue ? dueAt : null,
                createdBy: req.user.id,
                lines: { create: lines },
            },
            include: { lines: true, payments: true },
        });
        await enqueueOutbox(tx, {
            organizationId: job.organizationId,
            eventType: issue ? "invoice.issued" : "invoice.created",
            aggregateType: "Invoice",
            aggregateId: invoice.id,
            payload: { invoiceId: invoice.id, repairJobId: job.id, invoiceNumber: invoice.invoiceNumber, total: invoice.total.toFixed(2) },
        });
        return invoice;
    });
};

const getInvoice = async (req, invoiceId) => {
    const invoice = await prisma.invoice.findUnique({
        where: { id: Number(invoiceId) },
        include: { lines: true, payments: { orderBy: { createdDate: "desc" } }, organization: true, repairJob: { include: { customer: true } } },
    });
    if (!invoice) throw new ApiError(404, "Invoice not found.");
    await ensureRepairJobAccess(req, invoice.repairJobId);
    return invoice;
};

const recordPayment = async (req, invoiceId, payload) => {
    if (!req.user || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) throw new ApiError(403, "Only administrators can record payments.");
    const invoice = await getInvoice(req, invoiceId);
    if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status)) throw new ApiError(409, "Invoice cannot accept payments in its current status.");
    const amount = money(payload.amount, "amount");
    if (!amount.greaterThan(0)) throw new ApiError(400, "amount must be positive.");
    if (invoice.amountPaid.plus(amount).greaterThan(invoice.total)) throw new ApiError(409, "Payment exceeds the outstanding invoice balance.");
    if (!String(payload.method || "").trim()) throw new ApiError(400, "method is required.");
    const externalRef = String(payload.externalRef || "").trim() || null;

    try {
        return await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoice.id} FOR UPDATE`;
            const currentInvoice = await tx.invoice.findUnique({ where: { id: invoice.id } });
            if (!["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(currentInvoice.status)) throw new ApiError(409, "Invoice cannot accept payments in its current status.");
            if (currentInvoice.amountPaid.plus(amount).greaterThan(currentInvoice.total)) throw new ApiError(409, "Payment exceeds the outstanding invoice balance.");
            if (externalRef) {
                const duplicate = await tx.payment.findUnique({
                    where: { invoiceId_externalRef: { invoiceId: invoice.id, externalRef } },
                    select: { id: true },
                });
                if (duplicate) throw new ApiError(409, "A payment with this external reference already exists for the invoice.");
            }
            const payment = await tx.payment.create({
                data: {
                    invoiceId: invoice.id,
                    status: "SUCCEEDED",
                    amount,
                    method: String(payload.method).trim(),
                    externalRef,
                    paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
                    createdBy: req.user.id,
                },
            });
            const amountPaid = currentInvoice.amountPaid.plus(amount);
            const updated = await tx.invoice.update({
                where: { id: invoice.id },
                data: { amountPaid, status: amountPaid.greaterThanOrEqualTo(currentInvoice.total) ? "PAID" : "PARTIALLY_PAID" },
            });
            await enqueueOutbox(tx, {
                organizationId: invoice.organizationId,
                eventType: "payment.succeeded",
                aggregateType: "Payment",
                aggregateId: payment.id,
                payload: { paymentId: payment.id, invoiceId: invoice.id, amount: amount.toFixed(2) },
            });
            return { invoice: updated, payment };
        });
    } catch (error) {
        if (externalRef && error?.code === "P2002") {
            throw new ApiError(409, "A payment with this external reference already exists for the invoice.");
        }
        throw error;
    }
};

const voidInvoice = async (req, invoiceId, reason) => {
    const invoice = await getInvoice(req, invoiceId);
    if (!req.user || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) throw new ApiError(403, "Only administrators can void invoices.");
    if (!String(reason || "").trim()) throw new ApiError(400, "reason is required.");
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${invoice.id} FOR UPDATE`;
        const current = await tx.invoice.findUnique({ where: { id: invoice.id } });
        if (!current) throw new ApiError(404, "Invoice not found.");
        if (current.amountPaid.greaterThan(0)) throw new ApiError(409, "Paid invoices must be refunded before they can be voided.");
        if (current.status === "VOID") throw new ApiError(409, "Invoice is already void.");
        return tx.invoice.update({ where: { id: current.id }, data: { status: "VOID", voidedAt: new Date() } });
    });
};

export { createInvoice, getInvoice, recordPayment, voidInvoice };
