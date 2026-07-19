import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createInventoryItem, listInventory, recordMovement } from "../services/inventory.service.js";

const list = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await listInventory(req, req.query), "Inventory fetched successfully.")));
const create = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await createInventoryItem(req, req.body), "Inventory item created successfully.")));
const move = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await recordMovement(req, req.params.id, req.body), "Inventory movement recorded successfully.")));

export { create, list, move };
