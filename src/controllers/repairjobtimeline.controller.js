import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    createAuditLog,
    listAuditLogs,
    listTracking,
} from "../services/repairjobtimeline.service.js";

const auditList = asyncHandler(async (req, res) => {
    const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id || req.body.id;
    const logs = await listAuditLogs(req, repairJobId);
    return res.status(200).json(new ApiResponse(200, logs, "Audit logs fetched successfully."));
});

const auditCreate = asyncHandler(async (req, res) => {
    const log = await createAuditLog(req, req.body);
    return res.status(201).json(new ApiResponse(201, log, "Audit log created successfully."));
});

const trackingList = asyncHandler(async (req, res) => {
    const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id || req.body.id;
    const tracking = await listTracking(req, repairJobId);
    return res.status(200).json(new ApiResponse(200, tracking, "Repair job tracking fetched successfully."));
});

export {
    auditCreate,
    auditList,
    trackingList,
};
