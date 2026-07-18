import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess, ensureUserCanAccessOrganization } from "../utils/accessControl.js";
import { randomUUID } from "crypto";
import { removeStoredFiles, storeUploadedFiles } from "../utils/fileUpload.js";
import { readTaxRate } from "../config/env.js";
import { enqueueOutbox } from "./outbox.service.js";
import prisma from "../db/prisma.js";
import { calculateTax, money, multiplyMoney, sumMoney } from "../utils/money.js";
import { paginatedData } from "../utils/pagination.js";

const ALLOWED_TRANSITIONS = {
    CREATED: new Set(["RECEIVED", "CANCELLED"]),
    RECEIVED: new Set(["IN_PROGRESS", "WAITING_PARTS", "CANCELLED"]),
    IN_PROGRESS: new Set(["WAITING_PARTS", "COMPLETED", "CANCELLED"]),
    WAITING_PARTS: new Set(["IN_PROGRESS", "CANCELLED"]),
    COMPLETED: new Set(),
    CANCELLED: new Set(),
};

const WORK_TYPES = new Set(["INSPECTION", "DIAGNOSIS", "REPAIR", "TEST", "QA"]);
const PRIORITIES = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);

const transitionRepairJob = async (req, repairJobId, requestedStatus, note = "") => {
    if (!req.user) throw new ApiError(403, "Only internal users can change repair job status.");
    await ensureRepairJobAccess(req, repairJobId);
    const nextStatus = String(requestedStatus || "").trim().toUpperCase();

    return prisma.$transaction(async (tx) => {
        const current = await tx.repairJob.findUnique({ where: { id: Number(repairJobId) } });
        if (!current) throw new ApiError(404, "Repair job not found.");
        if (current.jobStatus === nextStatus) return current;
        if (!ALLOWED_TRANSITIONS[current.jobStatus]?.has(nextStatus)) {
            throw new ApiError(409, `Repair job cannot move from ${current.jobStatus} to ${nextStatus}.`);
        }

        if (nextStatus === "COMPLETED" && process.env.REQUIRE_QA_BEFORE_COMPLETION !== "false") {
            const qa = await tx.repairJobWorkLog.findFirst({
                where: { repairJobId: current.id, type: "QA", passed: true },
                orderBy: { createdDate: "desc" },
            });
            if (!qa) throw new ApiError(409, "A passing QA work log is required before completion.");
        }
        if (nextStatus === "IN_PROGRESS") {
            const latestEstimate = await tx.repairEstimate.findFirst({ where: { repairJobId: current.id }, orderBy: { version: "desc" } });
            if (latestEstimate && ["SENT", "REJECTED", "EXPIRED"].includes(latestEstimate.status)) {
                throw new ApiError(409, `The latest estimate is ${latestEstimate.status} and does not authorize repair work.`);
            }
        }

        const now = new Date();
        const resumedSlaDueAt = current.jobStatus === "WAITING_PARTS" && current.slaPausedAt && current.slaDueAt
            ? new Date(current.slaDueAt.getTime() + (now.getTime() - current.slaPausedAt.getTime()))
            : undefined;
        const data = {
            jobStatus: nextStatus,
            ...(nextStatus === "RECEIVED" ? {
                receivedBy: req.user.id,
                receivedRoleBy: req.user.role,
                receivedDate: now,
            } : {}),
            ...(nextStatus === "WAITING_PARTS" ? { slaPausedAt: now } : {}),
            ...(current.jobStatus === "WAITING_PARTS" && nextStatus === "IN_PROGRESS"
                ? { slaPausedAt: null, slaDueAt: resumedSlaDueAt }
                : {}),
            ...(nextStatus === "COMPLETED" ? { completionDate: now } : {}),
        };
        const changed = await tx.repairJob.updateMany({ where: { id: current.id, jobStatus: current.jobStatus }, data });
        if (!changed.count) throw new ApiError(409, "Repair job was changed by another request. Reload and retry.");
        const updated = await tx.repairJob.findUnique({ where: { id: current.id } });

        await Promise.all([
            tx.repairJobTracking.create({
                data: { repairJobId: current.id, status: nextStatus, changedBy: req.user.id },
            }),
            tx.repairJobAuditLog.create({
                data: {
                    repairJobId: current.id,
                    actionType: "STATUS_CHANGE",
                    description: `Status changed from ${current.jobStatus} to ${nextStatus}${note ? `: ${note}` : ""}`,
                    performedBy: req.user.id,
                },
            }),
            enqueueOutbox(tx, {
                organizationId: current.organizationId,
                eventType: "repair_job.status_changed",
                aggregateType: "RepairJob",
                aggregateId: current.id,
                payload: { repairJobId: current.id, previousStatus: current.jobStatus, status: nextStatus },
            }),
            enqueueOutbox(tx, {
                organizationId: current.organizationId,
                eventType: "email.repair_status",
                aggregateType: "RepairJob",
                aggregateId: current.id,
                payload: { repairJobId: current.id },
            }),
            tx.notification.create({
                data: {
                    organizationId: current.organizationId,
                    recipientType: "CUSTOMER",
                    recipientId: current.customerId,
                    referenceType: "REPAIR_JOB",
                    referenceId: current.id,
                    title: "Repair job status updated",
                    message: `Your repair job status is now ${nextStatus.replaceAll("_", " ")}.`,
                },
            }),
        ]);
        return updated;
    });
};

const assignRepairJob = async (req, repairJobId, technicianId, priority) => {
    if (!req.user || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
        throw new ApiError(403, "Only administrators can assign repair jobs.");
    }
    const job = await ensureRepairJobAccess(req, repairJobId);
    if (priority && !PRIORITIES.has(String(priority).toUpperCase())) throw new ApiError(400, "Invalid priority.");

    const technician = await prisma.user.findFirst({
        where: {
            id: Number(technicianId),
            role: "TECHNICIAN",
            isActive: true,
            isLocked: false,
            userOrganizations: { some: { organizationId: job.organizationId } },
        },
        select: { id: true, firstName: true, lastName: true },
    });
    if (!technician) throw new ApiError(404, "Eligible technician not found.");

    return prisma.$transaction(async (tx) => {
        const updated = await tx.repairJob.update({
            where: { id: job.id },
            data: {
                assignedTo: technician.id,
                assignedDate: new Date(),
                ...(priority ? { priority: String(priority).toUpperCase() } : {}),
            },
        });
        await tx.repairJobAuditLog.create({
            data: {
                repairJobId: job.id,
                actionType: "UPDATE",
                description: `Assigned to ${technician.firstName} ${technician.lastName}.`,
                performedBy: req.user.id,
            },
        });
        await tx.notification.create({
            data: {
                organizationId: job.organizationId,
                recipientType: "USER",
                recipientId: technician.id,
                referenceType: "REPAIR_JOB",
                referenceId: job.id,
                title: "Repair job assigned",
                message: `Repair job ${job.id} has been assigned to you.`,
            },
        });
        await enqueueOutbox(tx, {
            organizationId: job.organizationId,
            eventType: "repair_job.assigned",
            aggregateType: "RepairJob",
            aggregateId: job.id,
            payload: { repairJobId: job.id, technicianId: technician.id },
        });
        return updated;
    });
};

const addWorkLog = async (req, repairJobId, payload) => {
    if (!req.user) throw new ApiError(403, "Only internal users can add work logs.");
    const job = await ensureRepairJobAccess(req, repairJobId);
    const type = String(payload.type || "").toUpperCase();
    if (!WORK_TYPES.has(type)) throw new ApiError(400, "Invalid work log type.");
    if (!String(payload.summary || "").trim()) throw new ApiError(400, "summary is required.");
    if (req.user.role === "TECHNICIAN" && job.assignedTo && job.assignedTo !== req.user.id) {
        throw new ApiError(403, "This repair job is assigned to another technician.");
    }

    return prisma.$transaction(async (tx) => {
        const workLog = await tx.repairJobWorkLog.create({
            data: {
                repairJobId: job.id,
                type,
                summary: String(payload.summary).trim(),
                details: payload.details || undefined,
                durationMin: payload.durationMin ? Number(payload.durationMin) : null,
                passed: payload.passed === undefined ? null : payload.passed === true || payload.passed === "true",
                performedBy: req.user.id,
            },
        });
        await tx.repairJobAuditLog.create({
            data: {
                repairJobId: job.id,
                actionType: "UPDATE",
                description: `${type} work log added: ${workLog.summary}`,
                performedBy: req.user.id,
            },
        });
        return workLog;
    });
};

const submitRmaRequest = async (req, payload, files = []) => {
    if (!req.customer) throw new ApiError(403, "Only customers can submit an RMA request.");
    const required = ["sku", "productName", "serialNumber", "productFault"];
    if (required.some((field) => !String(payload[field] || payload[field.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)] || "").trim())) {
        throw new ApiError(400, "sku, productName, serialNumber, and productFault are required.");
    }
    const data = {
        organizationId: req.customer.organizationId,
        customerId: req.customer.id,
        sku: String(payload.sku).trim(),
        productName: String(payload.productName || payload.product_name).trim(),
        serialNumber: String(payload.serialNumber || payload.serial_number).trim(),
        productFault: String(payload.productFault || payload.product_fault).trim(),
        salesInvoice: payload.salesInvoice || payload.sales_invoice || null,
        customerTrackingNumber: payload.customerTrackingNumber || payload.customer_tracking_number || null,
        requestedResolution: payload.requestedResolution ? String(payload.requestedResolution).toUpperCase() : null,
    };

    const storedFiles = files.length
        ? await storeUploadedFiles(files, `rma-request-${randomUUID()}`, "evidence")
        : [];
    try {
        return await prisma.$transaction(async (tx) => {
            const request = await tx.rmaRequest.create({ data });
            if (storedFiles.length) {
                await tx.rmaRequestDocument.createMany({
                    data: storedFiles.map((file) => ({
                        rmaRequestId: request.id,
                        documentName: file.name,
                        documentUrl: file.reference,
                        documentType: /\.(jpe?g|png|webp)$/i.test(file.name) ? "IMAGE" : /\.pdf$/i.test(file.name) ? "PDF" : "OTHER",
                        fileHash: file.hash,
                    })),
                });
            }
            await enqueueOutbox(tx, {
                organizationId: request.organizationId,
                eventType: "rma_request.submitted",
                aggregateType: "RmaRequest",
                aggregateId: request.id,
                payload: { requestId: request.id, customerId: request.customerId },
            });
            return request;
        });
    } catch (error) {
        await removeStoredFiles(storedFiles);
        throw error;
    }
};

const reviewRmaRequest = async (req, requestId, decision, note) => {
    if (!req.user || !["ADMIN", "SUPER_ADMIN"].includes(req.user.role)) {
        throw new ApiError(403, "Only administrators can review RMA requests.");
    }
    const nextStatus = String(decision || "").toUpperCase();
    if (!["ACCEPTED", "REJECTED"].includes(nextStatus)) throw new ApiError(400, "Decision must be ACCEPTED or REJECTED.");

    const requestScope = await prisma.rmaRequest.findUnique({
        where: { id: Number(requestId) },
        select: { id: true, organizationId: true },
    });
    if (!requestScope) throw new ApiError(404, "RMA request not found.");
    await ensureUserCanAccessOrganization(req.user, requestScope.organizationId);

    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "RmaRequest" WHERE "id" = ${requestScope.id} FOR UPDATE`;
        const request = await tx.rmaRequest.findUnique({
            where: { id: requestScope.id },
            include: { customer: { select: { customerCode: true } } },
        });
        if (!request) throw new ApiError(404, "RMA request not found.");
        if (!["SUBMITTED", "UNDER_REVIEW"].includes(request.status)) {
            throw new ApiError(409, "RMA request has already been reviewed.");
        }

        let repairJob = null;
        if (nextStatus === "ACCEPTED") {
            const settings = await tx.organizationSetting.findUnique({ where: { organizationId: request.organizationId } });
            const slaDueAt = new Date(Date.now() + Number(settings?.defaultSlaHours || 120) * 3600000);
            repairJob = await tx.repairJob.create({
                data: {
                    raJobId: `${request.customer.customerCode}-${String(request.id).padStart(6, "0")}`,
                    organizationId: request.organizationId,
                    customerId: request.customerId,
                    sku: request.sku,
                    productName: request.productName,
                    serialNumber: request.serialNumber,
                    productFault: request.productFault,
                    salesInvoice: request.salesInvoice,
                    customerTrackingNumber: request.customerTrackingNumber,
                    resolutionType: request.requestedResolution,
                    createdBy: req.user.id,
                    createdRoleBy: req.user.role,
                    intakeSource: "CUSTOMER_PORTAL",
                    slaDueAt,
                },
            });
            await tx.repairJobTracking.create({
                data: { repairJobId: repairJob.id, status: "CREATED", changedBy: req.user.id },
            });
        }

        const updatedRequest = await tx.rmaRequest.update({
            where: { id: request.id },
            data: {
                status: nextStatus,
                reviewNote: String(note || "").trim() || null,
                reviewedBy: req.user.id,
                reviewedAt: new Date(),
                repairJobId: repairJob?.id,
            },
        });
        await enqueueOutbox(tx, {
            organizationId: request.organizationId,
            eventType: `rma_request.${nextStatus.toLowerCase()}`,
            aggregateType: "RmaRequest",
            aggregateId: request.id,
            payload: { requestId: request.id, repairJobId: repairJob?.id || null },
        });
        return { request: updatedRequest, repairJob };
    });
};

const listRmaRequests = async (req, filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const where = req.customer
        ? { customerId: req.customer.id, organizationId: req.customer.organizationId }
        : {
            ...(filters.organizationId ? { organizationId: Number(filters.organizationId) } : {}),
            ...(filters.status ? { status: String(filters.status).toUpperCase() } : {}),
        };
    if (req.user && filters.organizationId) await ensureUserCanAccessOrganization(req.user, filters.organizationId);
    if (req.user && req.user.role !== "SUPER_ADMIN" && !filters.organizationId) {
        throw new ApiError(400, "organizationId is required.");
    }
    const [requests, total] = await Promise.all([
        prisma.rmaRequest.findMany({ where, orderBy: { createdDate: "desc" }, skip: (page - 1) * limit, take: limit }),
        prisma.rmaRequest.count({ where }),
    ]);
    return paginatedData(requests, { total, page, limit }, "requests");
};

const getRepairWorkflow = async (req, repairJobId) => {
    await ensureRepairJobAccess(req, repairJobId);
    return prisma.repairJob.findUnique({
        where: { id: Number(repairJobId) },
        select: {
            id: true, raJobId: true, jobStatus: true, priority: true,
            assignedTo: true, assignedDate: true, dueDate: true, slaDueAt: true, slaPausedAt: true,
            workLogs: { orderBy: { createdDate: "desc" }, take: 100, include: { user: { select: { id: true, firstName: true, lastName: true } } } },
            estimates: { orderBy: { version: "desc" }, take: 50, include: { lines: true } },
            shipments: { orderBy: { createdDate: "desc" }, take: 50, include: { events: { orderBy: { occurredAt: "desc" }, take: 100 } } },
            invoices: { orderBy: { createdDate: "desc" }, take: 50, include: { lines: true, payments: true } },
        },
    });
};

const createEstimate = async (req, repairJobId, payload) => {
    if (!req.user) throw new ApiError(403, "Only internal users can create estimates.");
    const job = await ensureRepairJobAccess(req, repairJobId);
    if (!Array.isArray(payload.lines) || !payload.lines.length) throw new ApiError(400, "At least one estimate line is required.");
    const lines = payload.lines.map((line) => {
        const quantity = Number(line.quantity || 1);
        const unitPrice = money(line.unitPrice, "unitPrice");
        if (!Number.isInteger(quantity) || quantity <= 0) {
            throw new ApiError(400, "Estimate lines require a positive quantity and non-negative unitPrice.");
        }
        return { description: String(line.description || "").trim(), quantity, unitPrice, total: multiplyMoney(unitPrice, quantity) };
    });
    if (lines.some((line) => !line.description)) throw new ApiError(400, "Every estimate line requires a description.");

    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "RepairJob" WHERE "id" = ${job.id} FOR UPDATE`;
        const settings = await tx.organizationSetting.findUnique({ where: { organizationId: job.organizationId } });
        const configuredTaxRate = settings?.taxRate ?? readTaxRate();
        const subtotal = sumMoney(lines.map((line) => line.total));
        const tax = calculateTax(subtotal, configuredTaxRate);
        const latest = await tx.repairEstimate.aggregate({ where: { repairJobId: job.id }, _max: { version: true } });
        return tx.repairEstimate.create({
            data: {
                repairJobId: job.id,
                version: (latest._max.version || 0) + 1,
                status: payload.send === true ? "SENT" : "DRAFT",
                currency: settings?.currency || process.env.INVOICE_CURRENCY || "NZD",
                subtotal,
                tax,
                total: subtotal.plus(tax),
                expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
                createdBy: req.user.id,
                lines: { create: lines },
            },
            include: { lines: true },
        });
    });
};

const decideEstimate = async (req, estimateId, decision, note) => {
    if (!req.customer) throw new ApiError(403, "Only customers can approve or reject estimates.");
    const estimateScope = await prisma.repairEstimate.findUnique({
        where: { id: Number(estimateId) },
        include: { repairJob: { select: { customerId: true } } },
    });
    if (!estimateScope || estimateScope.repairJob.customerId !== req.customer.id) throw new ApiError(404, "Estimate not found.");
    const status = String(decision || "").toUpperCase();
    if (!["APPROVED", "REJECTED"].includes(status)) throw new ApiError(400, "Decision must be APPROVED or REJECTED.");
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "RepairEstimate" WHERE "id" = ${estimateScope.id} FOR UPDATE`;
        const estimate = await tx.repairEstimate.findUnique({
            where: { id: estimateScope.id },
            include: { repairJob: { select: { customerId: true } } },
        });
        if (!estimate || estimate.repairJob.customerId !== req.customer.id) throw new ApiError(404, "Estimate not found.");
        if (estimate.status !== "SENT") throw new ApiError(409, "Estimate is not awaiting a decision.");
        if (estimate.expiresAt && estimate.expiresAt <= new Date()) throw new ApiError(409, "Estimate has expired.");
        return tx.repairEstimate.update({
            where: { id: estimate.id },
            data: { status, customerNote: String(note || "").trim() || null, decisionAt: new Date() },
            include: { lines: true },
        });
    });
};

export {
    ALLOWED_TRANSITIONS,
    addWorkLog,
    assignRepairJob,
    createEstimate,
    decideEstimate,
    getRepairWorkflow,
    listRmaRequests,
    reviewRmaRequest,
    submitRmaRequest,
    transitionRepairJob,
};
