import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    addRepairJobCost,
    listRepairJobCosts,
    updateRepairJobCost,
} from "../services/repairjobcosting.service.js";

const list = asyncHandler(async (req, res) => {
    const costs = await listRepairJobCosts(req, { ...req.query, ...req.body });
    return res.status(200).json(new ApiResponse(200, costs, "Repair job costs fetched successfully."));
});

const addRepairCost = asyncHandler(async (req, res) => {
    const repairCost = await addRepairJobCost(req, req.body);
    return res.status(201).json(new ApiResponse(201, repairCost, "Repair cost created successfully."));
});

const updateRepairCost = asyncHandler(async (req, res) => {
    const repairCost = await updateRepairJobCost(req, { ...req.body, id: req.params.id || req.body.id });
    return res.status(200).json(new ApiResponse(200, repairCost, "Repair cost updated successfully."));
});

export {
    addRepairCost,
    list,
    updateRepairCost,
};
