import { ApiError } from "./ApiError.js";
import prisma from "../db/prisma.js";

const isSuperAdmin = (user) => user?.role === "SUPER_ADMIN";

const getAssignedOrganizationIds = async (user) => {
    if (!user) return [];

    const rows = await prisma.userOrganization.findMany({
        where: { userId: user.id },
        select: { organizationId: true },
    });

    return rows.map((row) => row.organizationId);
};

const getAssignedCustomerIds = async (user) => {
    if (!user) return [];

    const rows = await prisma.userCustomer.findMany({
        where: { userId: user.id },
        select: { customerId: true },
    });

    return rows.map((row) => row.customerId);
};

const ensureUserCanAccessOrganization = async (user, organizationId) => {
    if (isSuperAdmin(user)) return;

    const assignedOrganizationIds = await getAssignedOrganizationIds(user);

    if (!assignedOrganizationIds.includes(Number(organizationId))) {
        throw new ApiError(403, "You do not have access to this organization.");
    }
};

const getRepairJobAccessWhere = async (req) => {
    if (req.customer) {
        return { customerId: req.customer.id };
    }

    if (isSuperAdmin(req.user)) {
        return {};
    }

    const [customerIds, organizationIds] = await Promise.all([
        getAssignedCustomerIds(req.user),
        getAssignedOrganizationIds(req.user),
    ]);

    return {
        customerId: { in: customerIds },
        organizationId: { in: organizationIds },
    };
};

const ensureRepairJobAccess = async (req, repairJobId) => {
    const repairJob = await prisma.repairJob.findFirst({
        where: {
            id: Number(repairJobId),
            ...(await getRepairJobAccessWhere(req)),
        },
        select: {
            id: true,
            organizationId: true,
            customerId: true,
            jobStatus: true,
        },
    });

    if (!repairJob) {
        throw new ApiError(404, "Repair job not found.");
    }

    return repairJob;
};

export {
    ensureRepairJobAccess,
    ensureUserCanAccessOrganization,
    getAssignedCustomerIds,
    getAssignedOrganizationIds,
    getRepairJobAccessWhere,
    isSuperAdmin,
};
