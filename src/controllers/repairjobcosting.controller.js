import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import prisma from "../db/prisma.js"
 
const list = asyncHandler( async(req,res) => {
    try {
        const {repair_job_id} = req.body
 
        if(!repair_job_id){
            return res.status(400).json(new ApiError(400," repair_job_id is empty"))
        }
 
        const listData = await prisma.repairJobCosting.findMany({
            where: { repairJobId: Number(repair_job_id) },
        });
 
        if(!listData || listData.length === 0){
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
 
        // totalCost / customerCharge are required with no default — computed
        // here since the original never set them (see conversion notes #2).
        const parsedQuantity = (quantity !== undefined && quantity !== null && quantity !== "") ? Number(quantity) : 1;
        const parsedUnitCost = Number(unit_cost);
        const billable = is_billable === true || is_billable === 'true';
        const totalCost = parsedQuantity * parsedUnitCost;
        const customerCharge = billable ? totalCost : 0;
 
        const repairCost = await prisma.repairJobCosting.create({
            data: {
                repairJobId: Number(repair_job_id),
                costType: String(cost_type).toUpperCase(), // mapped to CostType enum
                quantity: parsedQuantity,
                unitCost: parsedUnitCost,
                totalCost,
                billableToCustomer: billable,
                customerCharge,
            },
        });
 
        if(!repairCost){
            return res.status(400).json(new ApiError(400,"repair cost isn't successfully inserted."))
        }
 
        // description has no column on RepairJobCosting (see conversion notes #1) —
        // folded into the audit-log entry instead of being silently dropped.
        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(repair_job_id),
                actionType: "CREATE",
                description: `Repair cost is added. ${description}`,
                performedBy: Number(req.user?.id),
            },
        });
 
        return res.status(200).json(new ApiResponse(200,repairCost,"repair cost is inserted successfully."))
 
    } catch (error) {
        return res.status(400).json(new ApiError(400,`${error.message}`))
    }
})
 
const updateRepairCost = asyncHandler( async(req,res) =>{
    try {
        const {
            id,
            cost_type,
            description,
            quantity,
            unit_cost,
            is_billable
        } = req.body
 
        if([cost_type,description].some((field) => field?.trim() === "")){
            return res.status(400).json(new ApiError(400, "data is empty"))
        }
 
        const existing = await prisma.repairJobCosting.findUnique({ where: { id: Number(id) } });
        if(!existing){
            return res.status(400).json(new ApiError(400,"repair cost not found."))
        }
 
        // ⚠️ Recompute totalCost / customerCharge, falling back to the existing
        // stored values for anything not supplied in this request 
        const parsedQuantity = (quantity !== undefined && quantity !== null && quantity !== "") ? Number(quantity) : existing.quantity;
        const parsedUnitCost = (unit_cost !== undefined && unit_cost !== null && unit_cost !== "") ? Number(unit_cost) : Number(existing.unitCost);
        const billable = (is_billable !== undefined) ? (is_billable === true || is_billable === 'true') : existing.billableToCustomer;
        const totalCost = parsedQuantity * parsedUnitCost;
        const customerCharge = billable ? totalCost : 0;
 
        const repairCost = await prisma.repairJobCosting.update({
            where: { id: Number(id) },
            data: {
                costType: String(cost_type).toUpperCase(),
                quantity: parsedQuantity,
                unitCost: parsedUnitCost,
                totalCost,
                billableToCustomer: billable,
                customerCharge,
            },
        });
 
        if(!repairCost){
            return res.status(400).json(new ApiError(400,"repair cost isn't successfully inserted."))
        }
 
        // NOTE: uses the costing row's own repairJobId rather than a raw,
        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: existing.repairJobId,
                actionType: "UPDATE",
                description: `Repair cost is updated. ${description}`,
                performedBy: Number(req.user?.id),
            },
        });
 
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

// import {ApiError} from "../utils/ApiError.js"
// import {ApiResponse} from "../utils/ApiResponse.js"
// import {asyncHandler} from "../utils/asyncHandler.js"
// import {RepairJobCostingModel} from "../models/repairjobcosting.model.js"
// import { RepairJobModel } from "../models/repairjob.model.js"
// import { RepairJobAuditLogModel } from "../models/repairjobauditlog.model.js"
// import moment from "moment";


// const RepairJobCosting = new RepairJobCostingModel()
// const RepairJob = new RepairJobModel()
// const RepairJobAuditLog = new RepairJobAuditLogModel()


// const list = asyncHandler( async(req,res) => {
//     try {
//          const {repair_job_id} = req.body

//         if(!repair_job_id){
//             return res.status(400).json(new ApiError(400," repair_job_id is empty"))
//         }

//         const listData = await RepairJobCosting.find({repair_job_id}).execute();

//         if(!listData){
//             return res.status(400).json(new ApiError(400,"no data found."))
//         }
//         return res.status(200).json(new ApiResponse(200,listData,""))
//     } catch (error) {
//         return res.status(400).json(new ApiError(400,`${error.message}`))
//     }
// }) 


// const addRepairCost = asyncHandler( async(req,res) =>{
//     try {
//         const {
//             repair_job_id,
//             cost_type,
//             description,
//             quantity,
//             unit_cost,
//             is_billable
//         } = req.body

//         if([repair_job_id,cost_type,description].some((field) => field?.trim() === "")){
//                 return res.status(400).json(new ApiError(400, "All field are required"))
//         }


//         const repairCost = await RepairJobCosting.create({
//                 repair_job_id:repair_job_id,
//                 cost_type: cost_type,
//                 description: description,
//                 quantity: quantity,
//                 unit_cost: unit_cost,
//                 is_billable: is_billable,
//                 performed_by: req.user?.id
//             });
        
//         if(!repairCost){
//             return res.status(400).json(new ApiError(400,"repair cost isn't successfully inserted."))
//         }

//         // const repairjob = await RepairJob.update({id:ra_job_id},{resoultion_type:"repair", job_status:"closed"})    
//         // if(!repairjob){
//         //     return res.status(400).json(new ApiError(400," Repair job status isn't updated successfully."))
//         // }


//         const log = {
//                     repair_job_id: repair_job_id,
//                     action_type: "CREATE",
//                     description: `Repair cost is added.`,
//                     performed_by : req.user?.id,
//                     performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         // Log the result of the process
//         RepairJobAuditLog.create(log);
//         return res.status(200).json(new ApiResponse(200,repairCost,"repair cost is inserted successfully."))


//     } catch (error) {
//         return res.status(400).json(new ApiError(400,`${error.message}`))
//     }
// })

// const updateRepairCost = asyncHandler( async(req,res) =>{
//     try {
//         const {
//             id,
//             repair_job_id,
//             cost_type,
//             description,
//             quantity,
//             unit_cost,
//             is_billable
//         } = req.body

//         if([cost_type,description].some((field) => field?.trim() === "")){
//             return res.status(400).json(new ApiError(400, "data is empty"))
//         }

//         const repairCost = await RepairJobCosting.update({id:id},{
//                 cost_type: cost_type,
//                 description: description,
//                 quantity: quantity,
//                 unit_cost: unit_cost,
//                 is_billable: is_billable,
//                 performed_by: req.user?.id
//             });
        
//         if(!repairCost){
//             return res.status(400).json(new ApiError(400,"repair cost isn't successfully inserted."))
//         }

//         // const repairjob = await RepairJob.update({id:ra_job_id},{resoultion_type:"repair", job_status:"closed"})    
//         // if(!repairjob){
//         //     return res.status(400).json(new ApiError(400," Repair job status isn't updated successfully."))
//         // }

//         const log = {
//                     repair_job_id: repair_job_id,
//                     action_type: "UPDATE",
//                     description: `Repair cost is updated.`,
//                     performed_by : req.user?.id,
//                     performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         // Log the result of the process
//         RepairJobAuditLog.create(log);
//         return res.status(200).json(new ApiResponse(200,repairCost,"repair cost is inserted successfully."))

//     } catch (error) {
//         return res.status(400).json(new ApiError(400,`${error.message}`))
//     }
// })



// export {
//     list,
//     addRepairCost,
//     updateRepairCost
// }