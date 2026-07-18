import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { decryptDeviceCredential } from "../utils/encryption.js";
import prisma from "../db/prisma.js";

const getDeviceCredential = async (req, repairJobId, reason) => {
    if (!req.user) throw new ApiError(403, "Only internal users can access device credentials.");
    const access = await ensureRepairJobAccess(req, repairJobId);
    if (req.user.role === "TECHNICIAN" && access.assignedTo && access.assignedTo !== req.user.id) {
        throw new ApiError(403, "This repair job is assigned to another technician.");
    }
    if (!String(reason || "").trim()) throw new ApiError(400, "An access reason is required.");
    const job = await prisma.repairJob.findUnique({ where: { id: access.id }, select: { id: true, devicePassword: true } });
    if (!job?.devicePassword) return { repairJobId: access.id, credential: null };

    let credential;
    try {
        credential = decryptDeviceCredential(job.devicePassword);
    } catch {
        credential = job.devicePassword;
    }
    await prisma.repairJobAuditLog.create({
        data: {
            repairJobId: access.id,
            actionType: "CONTACT",
            description: `Device credential accessed. Reason: ${String(reason).trim()}`,
            performedBy: req.user.id,
        },
    });
    return { repairJobId: access.id, credential };
};

export { getDeviceCredential };
