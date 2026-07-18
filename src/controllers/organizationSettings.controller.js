import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getSettings, updateSettings } from "../services/organizationSettings.service.js";

const detail = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await getSettings(req, req.params.organizationId), "Organization settings fetched successfully.")));
const update = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await updateSettings(req, req.params.organizationId, req.body), "Organization settings updated successfully.")));
export { detail, update };
