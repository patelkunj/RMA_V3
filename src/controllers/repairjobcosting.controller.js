import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    addRepairJobCost,
    listRepairJobCosts,
    updateRepairJobCost,
} from "../services/repairjobcosting.service.js";

const list = asyncHandler(async (req, res) => {
    const costs = await listRepairJobCosts(req.body);
    return res.status(200).json(new ApiResponse(200, costs, ""));
});

const addRepairCost = asyncHandler(async (req, res) => {
    const repairCost = await addRepairJobCost(req.body, req.user);
    return res.status(200).json(new ApiResponse(200, repairCost, "repair cost is inserted successfully."));
});

const updateRepairCost = asyncHandler(async (req, res) => {
    const repairCost = await updateRepairJobCost(req.body, req.user);
    return res.status(200).json(new ApiResponse(200, repairCost, "repair cost is updated successfully."));
});

export {
    addRepairCost,
    list,
    updateRepairCost,
};
