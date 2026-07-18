import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPreference, updatePreference } from "../services/notificationPreference.service.js";

const detail = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await getPreference(req), "Notification preferences fetched successfully.")));
const update = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await updatePreference(req, req.body), "Notification preferences updated successfully.")));
export { detail, update };
