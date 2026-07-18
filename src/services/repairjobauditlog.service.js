import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../db/prisma.js"
import { respondWithSafeError } from "../utils/safeError.js";
import moment from "moment";

const list = asyncHandler( async(req,res) => {
    try {
        const {id} = req.body
        if(!id){
            return res.status(400).json(new ApiError(400," id is empty"))
        }

        // returning every audit-log entry for that job rather than a single row.
        const listData = await prisma.repairJobAuditLog.findMany({
            where: { repairJobId: Number(id) },
            orderBy: { performedAt: 'desc' },
        });

        if(!listData || listData.length === 0){
            return res.status(400).json(new ApiError(400,"no data found."))
        }
        return res.status(200).json(new ApiResponse(200,"success",listData));
    } catch (error) {
        return respondWithSafeError(res, error, "repair-job-audit.list", "Unable to list repair job audit logs.");
    }
});

const createLog = asyncHandler( async(req,res) => {
    try {
        const {
            repair_job_id,
            action_type,
            description
        } = req.body;

        if([repair_job_id,action_type,description].some(field => !field?.trim())){
            return res.status(400).json(new ApiError(400, "All fields are required"));
        }

        const newLog = await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(repair_job_id),
                actionType: String(action_type).toUpperCase(), // mapped to AuditAction enum — must be one of CREATE, UPDATE, DELETE, STATUS_CHANGE, COMMENT, CONTACT, COST_CHANGE
                description,
                performedBy: Number(req.user?.id)
            },
        });

        return res.status(201).json(new ApiResponse(201, "Log created successfully", newLog));

    } catch (error) {
        return respondWithSafeError(res, error, "repair-job-audit.create", "Unable to create repair job audit log.");
    }
});

export {
    list,
    createLog
}
