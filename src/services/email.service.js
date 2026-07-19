import { ApiError } from "../utils/ApiError.js";
import { Email } from "../utils/Email.js";
import { createInvoicePdfBuffer } from "../utils/pdf.js";
import {
    accountActivationEmail,
    billingInvoiceEmail,
    passwordResetEmail,
    repairJobStatusEmail,
} from "../templates/email.templates.js";
import { getInvoiceData } from "./pdfreport.service.js";
import prisma from "../db/prisma.js";
import { logger } from "../utils/logger.js";

const mailer = () => new Email();
const portalUrl = () => process.env.CUSTOMER_PORTAL_URL || process.env.APP_URL || "http://localhost:3000";
const buildPasswordResetUrl = ({ token, accountType }) => {
    const url = new URL(process.env.PASSWORD_RESET_URL || `${portalUrl()}/reset-password`);
    url.searchParams.set("token", token);
    url.searchParams.set("accountType", accountType);
    return url.toString();
};
const currency = (value) => new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: process.env.INVOICE_CURRENCY || "NZD",
}).format(Number(value || 0));

const sendAccountActivationEmail = ({ to, name, activationUrl }) => mailer().send(
    to,
    "Activate your RMA Service account",
    accountActivationEmail({ name, activationUrl })
);

const sendPasswordResetEmail = ({ to, name, resetUrl }) => mailer().send(
    to,
    "Reset your RMA Service password",
    passwordResetEmail({ name, resetUrl })
);

const sendRepairJobStatusEmail = async (repairJobId) => {
    const job = await prisma.repairJob.findUnique({
        where: { id: Number(repairJobId) },
        select: {
            id: true,
            raJobId: true,
            productName: true,
            jobStatus: true,
            customer: {
                select: {
                    companyName: true,
                    contactPersonName: true,
                    contactPersonEmail: true,
                    email: true,
                },
            },
        },
    });

    if (!job) throw new ApiError(404, "Repair job not found.");

    const recipient = job.customer.contactPersonEmail || job.customer.email;
    return mailer().send(
        recipient,
        `${job.raJobId || `RMA-${job.id}`} repair status: ${job.jobStatus.replaceAll("_", " ")}`,
        repairJobStatusEmail({
            customerName: job.customer.contactPersonName || job.customer.companyName,
            jobNumber: job.raJobId || `RMA-${job.id}`,
            status: job.jobStatus,
            productName: job.productName,
            statusUrl: `${portalUrl()}/repair-jobs/${job.id}`,
        })
    );
};

const sendRepairJobStatusEmailSafely = async (repairJobId) => {
    try {
        const result = await sendRepairJobStatusEmail(repairJobId);
        if (!result) logger.warn("Repair status email could not be sent", { repairJobId });
        return result;
    } catch (error) {
        logger.warn("Repair status email could not be prepared", {
            repairJobId,
            errorName: error?.name,
            message: error?.message,
        });
        return null;
    }
};

const sendBillingInvoiceEmail = async (req, repairJobId) => {
    const invoice = await getInvoiceData(req, repairJobId);
    const pdf = await createInvoicePdfBuffer(invoice);
    const recipient = invoice.customer.contactPersonEmail || invoice.customer.email;
    const filename = `invoice-${invoice.invoiceNumber}.pdf`.replace(/[^a-zA-Z0-9._-]/g, "-");

    const result = await mailer().send(
        recipient,
        `Invoice ${invoice.invoiceNumber} from ${invoice.organization?.name || "RMA Service"}`,
        billingInvoiceEmail({
            customerName: invoice.customer.contactPersonName || invoice.customer.companyName,
            invoiceNumber: invoice.invoiceNumber,
            jobNumber: invoice.jobNumber,
            total: currency(invoice.total),
            dueDate: invoice.dueDate,
        }),
        {
            attachments: [{
                filename,
                content: pdf,
                contentType: "application/pdf",
            }],
        }
    );

    if (!result) throw new ApiError(502, "Invoice email could not be sent.");

    return {
        repairJobId: Number(repairJobId),
        invoiceNumber: invoice.invoiceNumber,
        sent: true,
    };
};

export {
    buildPasswordResetUrl,
    sendAccountActivationEmail,
    sendBillingInvoiceEmail,
    sendPasswordResetEmail,
    sendRepairJobStatusEmail,
    sendRepairJobStatusEmailSafely,
};
