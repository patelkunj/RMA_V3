import { ApiError } from "../utils/ApiError.js";
import { ensureUserCanAccessOrganization } from "../utils/accessControl.js";
import prisma from "../db/prisma.js";

const resolveCustomer = async (req, customerId) => {
    const id = req.customer ? req.customer.id : Number(customerId);
    if (!id) throw new ApiError(400, "customerId is required.");
    const customer = await prisma.customer.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!customer) throw new ApiError(404, "Customer not found.");
    if (req.customer && customer.id !== req.customer.id) throw new ApiError(404, "Customer not found.");
    if (req.user) await ensureUserCanAccessOrganization(req.user, customer.organizationId);
    return customer;
};

const exportCustomerData = async (req, customerId, filters = {}) => {
    const customerAccess = await resolveCustomer(req, customerId);
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const customer = await prisma.customer.findUnique({
        where: { id: customerAccess.id },
        select: {
            id: true, organizationId: true, companyName: true, customerCode: true, email: true,
            contactPersonName: true, contactPersonEmail: true, mobile: true, returnAddress: true,
            warrantyMonths: true, warrantyTypes: true, doaWarrantyDays: true, doaWarrantyTypes: true,
            warrantyRemarks: true, salesPerson: true, createdDate: true, updatedDate: true,
        },
    });
    const [repairJobs, total] = await Promise.all([
        prisma.repairJob.findMany({
            where: { customerId: customerAccess.id },
            orderBy: { id: "asc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
                id: true, raJobId: true, sku: true, productName: true, serialNumber: true,
                productFault: true, customerTrackingNumber: true, dispatchId: true, resolutionType: true,
                jobStatus: true, createdDate: true, updatedDate: true, completionDate: true,
                chats: { select: { id: true, senderRole: true, message: true, createdDate: true }, take: 500 },
                documents: { select: { id: true, documentName: true, documentType: true, uploadedDate: true, isActive: true }, take: 500 },
            },
        }),
        prisma.repairJob.count({ where: { customerId: customerAccess.id } }),
    ]);
    return { customer, repairJobs, page, limit, totalRepairJobs: total, totalPages: Math.ceil(total / limit) };
};

const createPrivacyRequest = async (req, payload) => {
    const customer = await resolveCustomer(req, payload.customerId);
    const type = String(payload.type || "").toUpperCase();
    if (!["EXPORT", "ERASURE"].includes(type)) throw new ApiError(400, "type must be EXPORT or ERASURE.");
    return prisma.privacyRequest.create({
        data: {
            organizationId: customer.organizationId,
            customerId: customer.id,
            type,
            requestedByType: req.customer ? "CUSTOMER" : "USER",
            requestedById: req.customer?.id || req.user.id,
            reason: String(payload.reason || "").trim() || null,
        },
    });
};

const listPrivacyRequests = async (req, organizationId) => {
    if (req.customer) return prisma.privacyRequest.findMany({ where: { customerId: req.customer.id }, orderBy: { createdDate: "desc" } });
    await ensureUserCanAccessOrganization(req.user, organizationId);
    return prisma.privacyRequest.findMany({ where: { organizationId: Number(organizationId) }, orderBy: { createdDate: "desc" }, take: 100 });
};

export { createPrivacyRequest, exportCustomerData, listPrivacyRequests };
