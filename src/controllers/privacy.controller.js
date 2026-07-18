import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createPrivacyRequest, exportCustomerData, listPrivacyRequests } from "../services/privacy.service.js";

const exportData = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await exportCustomerData(req, req.query.customerId, req.query), "Customer data exported successfully.")));
const create = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await createPrivacyRequest(req, req.body), "Privacy request submitted successfully.")));
const list = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await listPrivacyRequests(req, req.query.organizationId), "Privacy requests fetched successfully.")));
export { create, exportData, list };
