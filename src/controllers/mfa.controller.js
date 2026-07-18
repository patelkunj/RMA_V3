import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { disableMfa, enableMfa, setupMfa } from "../services/mfa.service.js";

const actor = (req) => req.user || req.customer;
const setup = asyncHandler(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(new ApiResponse(200, await setupMfa(actor(req)), "MFA setup started."));
});
const enable = asyncHandler(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json(new ApiResponse(200, await enableMfa(actor(req), req.body.code), "MFA enabled successfully. Store the recovery codes securely."));
});
const disable = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await disableMfa(actor(req), req.body.code), "MFA disabled successfully.")));
export { disable, enable, setup };
