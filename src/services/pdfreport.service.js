import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import {
    createInvoicePdfBuffer,
    createPdfBuffer,
} from "../utils/pdf.js";
import prisma from "../db/prisma.js";
import dotenv from "dotenv";

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
    const lines = [
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

const invoicePdf = async (req, repairJobId) => {
    const job = await getRepairJobReportData(req, repairJobId);
    const subtotal = job.costings
        .filter((cost) => cost.costType !== "TAX")
        .reduce((sum, cost) => sum + Number(cost.customerCharge || 0), 0);
    const tax = subtotal * (Number(process.env.TAX_RATE || 0) / 100);
    const total = subtotal + tax;
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

    return createInvoicePdfBuffer({
        invoiceNumber: job.raJobId || `RMA-${job.id}`,
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
    });
};

export {
    invoicePdf,
    serviceReportPdf,
};
