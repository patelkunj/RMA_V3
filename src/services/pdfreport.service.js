import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import {
    createInvoicePdfBuffer,
    createPdfBuffer,
} from "../utils/pdf.js";
import prisma from "../db/prisma.js";
import { readTaxRate } from "../config/env.js";
import { loadOrganizationLogoForPdf } from "./organization.service.js";
import { calculateTax, sumMoney } from "../utils/money.js";

const dateOnly = (value) => value ? new Date(value).toISOString().slice(0, 10) : "";
const addDays = (value, days) => {
    const date = new Date(value);
    date.setDate(date.getDate() + Number(days || 0));
    return date;
};

const getRepairJobReportData = async (req, repairJobId) => {
    await ensureRepairJobAccess(req, repairJobId);

    const repairJob = await prisma.repairJob.findUnique({
        where: { id: Number(repairJobId) },
        include: {
            organization: true,
            customer: true,
            costings: {
                include: {
                    product: true,
                },
                orderBy: { id: "asc" },
            },
            comments: {
                orderBy: { createdDate: "desc" },
                take: 5,
            },
        },
    });

    if (!repairJob) {
        throw new ApiError(404, "Repair job not found.");
    }

    return repairJob;
};

const serviceReportPdf = async (req, repairJobId) => {
    const job = await getRepairJobReportData(req, repairJobId);
    const logo = await loadOrganizationLogoForPdf(job.organization);
    const lines = [
        ...(logo ? [{ type: "image", source: logo.buffer, width: 150, height: 70 }] : []),
        { text: "Service Report", size: 18, leading: 24 },
        { text: `RA Job: ${job.raJobId || job.id}`, size: 12 },
        { type: "space", size: 8 },
        { text: `Organization: ${job.organization?.name || ""}` },
        { text: `Customer: ${job.customer?.companyName || ""} (${job.customer?.customerCode || ""})` },
        { text: `Status: ${job.jobStatus}` },
        { text: `Created: ${dateOnly(job.createdDate)}  Received: ${dateOnly(job.receivedDate)}  Completed: ${dateOnly(job.completionDate)}` },
        { type: "space", size: 8 },
        { text: `Product: ${job.productName}` },
        { text: `SKU: ${job.sku}` },
        { text: `Serial Number: ${job.serialNumber}` },
        { text: `Warranty: ${job.isProductUnderWarranty ? "Yes" : "No"}  DOA: ${job.isDoa ? "Yes" : "No"}` },
        { type: "space", size: 8 },
        { text: "Fault", size: 12 },
        { text: job.productFault || "" },
        { type: "space", size: 8 },
        { text: "Resolution" , size: 12 },
        { text: `Resolution Type: ${job.resolutionType || ""}` },
        { text: `Dispatch ID: ${job.dispatchId || ""}` },
        { text: `Customer Tracking Number: ${job.customerTrackingNumber || ""}` },
    ];

    if (job.comments.length) {
        lines.push({ type: "space", size: 8 }, { text: "Recent Notes", size: 12 });
        for (const comment of job.comments) {
            lines.push({ text: `${dateOnly(comment.createdDate)} - ${comment.comment}` });
        }
    }

    return createPdfBuffer(lines);
};

const getInvoiceData = async (req, repairJobId) => {
    const job = await getRepairJobReportData(req, repairJobId);
    const logo = await loadOrganizationLogoForPdf(job.organization);
    const persistedInvoice = await prisma.invoice.findFirst({
        where: { repairJobId: job.id, status: { not: "VOID" } },
        include: { lines: { orderBy: { id: "asc" } } },
        orderBy: { createdDate: "desc" },
    });
    if (persistedInvoice) {
        return {
            invoiceNumber: persistedInvoice.invoiceNumber,
            jobNumber: job.raJobId || `RMA-${job.id}`,
            issueDate: dateOnly(persistedInvoice.issuedAt || persistedInvoice.createdDate),
            dueDate: dateOnly(persistedInvoice.dueAt),
            organization: job.organization,
            customer: job.customer,
            items: persistedInvoice.lines.map((line) => ({
                description: line.description,
                rate: Number(line.unitPrice),
                quantity: line.quantity,
                total: Number(line.total),
            })),
            subtotal: Number(persistedInvoice.subtotal),
            tax: Number(persistedInvoice.tax),
            total: Number(persistedInvoice.total),
            paymentInfo: {
                bankName: process.env.INVOICE_BANK_NAME || job.organization?.name || "",
                accountName: process.env.INVOICE_ACCOUNT_NAME || job.organization?.name || "",
                accountNumber: process.env.INVOICE_ACCOUNT_NUMBER || job.organization?.email || "",
            },
            signatureName: process.env.INVOICE_SIGNATURE_NAME || job.organization?.name || "",
            logo,
        };
    }
    const subtotalDecimal = sumMoney(job.costings
        .filter((cost) => cost.costType !== "TAX")
        .map((cost) => cost.customerCharge || 0));
    const taxDecimal = calculateTax(subtotalDecimal, readTaxRate());
    const totalDecimal = subtotalDecimal.plus(taxDecimal);
    const subtotal = subtotalDecimal.toNumber();
    const tax = taxDecimal.toNumber();
    const total = totalDecimal.toNumber();
    const invoiceDate = new Date();
    const dueDate = addDays(invoiceDate, job.customer?.paymentTerms || 0);
    const items = job.costings
        .filter((cost) => cost.costType !== "TAX")
        .map((cost) => ({
            description: [
                cost.costType.replace(/_/g, " "),
                cost.product?.sku,
                cost.product?.name,
            ].filter(Boolean).join(" - "),
            rate: Number(cost.unitCost || 0),
            quantity: cost.quantity,
            total: Number(cost.customerCharge || 0),
        }));

    return {
        invoiceNumber: job.raJobId || `RMA-${job.id}`,
        jobNumber: job.raJobId || `RMA-${job.id}`,
        issueDate: dateOnly(invoiceDate),
        dueDate: dateOnly(dueDate),
        organization: job.organization,
        customer: job.customer,
        items,
        subtotal,
        tax,
        total,
        paymentInfo: {
            bankName: process.env.INVOICE_BANK_NAME || job.organization?.name || "",
            accountName: process.env.INVOICE_ACCOUNT_NAME || job.organization?.name || "",
            accountNumber: process.env.INVOICE_ACCOUNT_NUMBER || job.organization?.email || "",
        },
        signatureName: process.env.INVOICE_SIGNATURE_NAME || job.organization?.name || "",
        logo,
    };
};

const invoicePdf = async (req, repairJobId) => {
    const invoice = await getInvoiceData(req, repairJobId);
    return createInvoicePdfBuffer(invoice);
};

export {
    getInvoiceData,
    invoicePdf,
    serviceReportPdf,
};
