import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createShipment, updateShipmentStatus } from "../services/logistics.service.js";

const create = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await createShipment(req, req.params.repairJobId, req.body), "Shipment created successfully.")));
const updateStatus = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await updateShipmentStatus(req, req.params.id, req.body), "Shipment status updated successfully.")));
export { create, updateStatus };
