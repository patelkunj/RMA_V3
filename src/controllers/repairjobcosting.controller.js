import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {RepairJobCostingModel} from "../models/repairjobcosting.model.js"
import { RepairJobModel } from "../models/repairjob.model.js"
import { RepairJobAuditLogModel } from "../models/repairjobauditlog.model.js"
import moment from "moment";


const RepairJobCosting = new RepairJobCostingModel()
const RepairJob = new RepairJobModel()
const RepairJobAuditLog = new RepairJobAuditLogModel()


const list = asyncHandler( async(req,res) => {
    try {
         const {repair_job_id} = req.body

        if(!repair_job_id){
            return res.status(400).json(new ApiError(400," repair_job_id is empty"))
        }

        const listData = await RepairJobCosting.find({repair_job_id}).execute();

        if(!listData){
            return res.status(400).json(new ApiError(400,"no data found."))
        }
        return res.status(200).json(new ApiResponse(200,listData,""))
    } catch (error) {
        return res.status(400).json(new ApiError(400,`${error.message}`))
    }
}) 


const addRepairCost = asyncHandler( async(req,res) =>{
    try {
        const {
            repair_job_id,
            cost_type,
            description,
            quantity,
            unit_cost,
            is_billable
        } = req.body

        if([repair_job_id,cost_type,description].some((field) => field?.trim() === "")){
                return res.status(400).json(new ApiError(400, "All field are required"))
        }


        const repairCost = await RepairJobCosting.create({
                repair_job_id:repair_job_id,
                cost_type: cost_type,
                description: description,
                quantity: quantity,
                unit_cost: unit_cost,
                is_billable: is_billable,
                performed_by: req.user?.id
            });
        
        if(!repairCost){
            return res.status(400).json(new ApiError(400,"repair cost isn't successfully inserted."))
        }

        // const repairjob = await RepairJob.update({id:ra_job_id},{resoultion_type:"repair", job_status:"closed"})    
        // if(!repairjob){
        //     return res.status(400).json(new ApiError(400," Repair job status isn't updated successfully."))
        // }


        const log = {
                    repair_job_id: repair_job_id,
                    action_type: "CREATE",
                    description: `Repair cost is added.`,
                    performed_by : req.user?.id,
                    performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        // Log the result of the process
        RepairJobAuditLog.create(log);
        return res.status(200).json(new ApiResponse(200,repairCost,"repair cost is inserted successfully."))


    } catch (error) {
        return res.status(400).json(new ApiError(400,`${error.message}`))
    }
})

const updateRepairCost = asyncHandler( async(req,res) =>{
    try {
        const {
            id,
            repair_job_id,
            cost_type,
            description,
            quantity,
            unit_cost,
            is_billable
        } = req.body

        if([cost_type,description].some((field) => field?.trim() === "")){
            return res.status(400).json(new ApiError(400, "data is empty"))
        }

        const repairCost = await RepairJobCosting.update({id:id},{
                cost_type: cost_type,
                description: description,
                quantity: quantity,
                unit_cost: unit_cost,
                is_billable: is_billable,
                performed_by: req.user?.id
            });
        
        if(!repairCost){
            return res.status(400).json(new ApiError(400,"repair cost isn't successfully inserted."))
        }

        // const repairjob = await RepairJob.update({id:ra_job_id},{resoultion_type:"repair", job_status:"closed"})    
        // if(!repairjob){
        //     return res.status(400).json(new ApiError(400," Repair job status isn't updated successfully."))
        // }

        const log = {
                    repair_job_id: repair_job_id,
                    action_type: "UPDATE",
                    description: `Repair cost is updated.`,
                    performed_by : req.user?.id,
                    performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        // Log the result of the process
        RepairJobAuditLog.create(log);
        return res.status(200).json(new ApiResponse(200,repairCost,"repair cost is inserted successfully."))

    } catch (error) {
        return res.status(400).json(new ApiError(400,`${error.message}`))
    }
})



export {
    list,
    addRepairCost,
    updateRepairCost
}