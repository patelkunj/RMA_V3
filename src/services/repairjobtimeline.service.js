import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import prisma from "../db/prisma.js";

const AUDIT_ACTIONS = new Set(["CREATE", "UPDATE", "DELETE", "STATUS_CHANGE", "COMMENT", "CONTACT", "COST_CHANGE"]);

const normalizeAuditAction = (value) => {
    const action = String(value || "").trim().toUpperCase();
    if (!AUDIT_ACTIONS.has(action)) {
        throw new ApiError(400, "Invalid audit action.");
    }
    return action;
};

const listAuditLogs = async (req, repairJobId) => {
    if (!repairJobId) {
        throw new ApiError(400, "repairJobId is required.");
    }

    await ensureRepairJobAccess(req, repairJobId);

    return prisma.repairJobAuditLog.findMany({
        where: { repairJobId: Number(repairJobId) },
        orderBy: { performedAt: "desc" },
    });
};

const createAuditLog = async (req, payload) => {
    const repairJobId = payload.repairJobId || payload.repair_job_id;
    const actionType = payload.actionType || payload.action_type;

    if ([repairJobId, actionType, payload.description].some((field) => String(field ?? "").trim() === "")) {
        throw new ApiError(400, "All fields are required.");
    }

    await ensureRepairJobAccess(req, repairJobId);

    return prisma.repairJobAuditLog.create({
        data: {
            repairJobId: Number(repairJobId),
            actionType: normalizeAuditAction(actionType),
            description: String(payload.description).trim(),
            performedBy: Number(req.user.id),
        },
    });
};

const listTracking = async (req, repairJobId) => {
    if (!repairJobId) {
        throw new ApiError(400, "repairJobId is required.");
    }

    await ensureRepairJobAccess(req, repairJobId);

    return prisma.repairJobTracking.findMany({
        where: { repairJobId: Number(repairJobId) },
        orderBy: { changedDate: "desc" },
        include: {
            changedByUser: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    role: true,
                },
            },
        },
    });
};

export {
    createAuditLog,
    listAuditLogs,
    listTracking,
};
