import { ApiResponse } from "../utils/ApiResponse";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { RepairJobAuditLogModel } from "../models/repairjobauditlog.model.js";
import moment from "moment"; 

const RepairJobAuditLog = new RepairJobAuditLogModel();

const list = asyncHandler( async(req,res) => {
    try {
         const {id} = req.body  
        if(!id){
            return res.status(400).json(new ApiError(400," id is empty"))
        }  
        const listData = await RepairJobAuditLog.find({'id':id}).execute();
        if(!listData){
            return res.status(400).json(new ApiError(400,"no data found."))
        }
        return res.status(200).json(new ApiResponse(200,"success",listData));
    } catch (error) {
        return res.status(500).json(new ApiError(500,error.message));
    }
});

const createLog = asyncHandler( async(req,res) => {
    try {
        const {
            repair_job_id,
            action_type,
            description,
            log_status
        } = req.body;   

        if([repair_job_id,action_type,description,log_status].some(field => !field?.trim())){
            return res.status(400).json(new ApiError(400, "All fields are required"));
        } 

        const newLog = await RepairJobAuditLog.create({
                repair_job_id,
                action_type,
                description,
                log_status
        });

        return res.status(201).json(new ApiResponse(201, "Log created successfully", newLog));
        
    } catch (error) {
        return res.status(500).json(new ApiError(500, error.message));
    }
});

export {
    list,
    createLog
}