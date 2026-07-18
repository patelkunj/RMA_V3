import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getDeviceCredential } from "../services/deviceCredential.service.js";

const detail = asyncHandler(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(new ApiResponse(200, await getDeviceCredential(req, req.params.id, req.query.reason), "Device credential fetched successfully."));
});
export { detail };
