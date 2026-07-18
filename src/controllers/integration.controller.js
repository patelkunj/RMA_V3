import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createApiKey, createWebhook, listIntegrations, revokeApiKey } from "../services/integration.service.js";

const createKey = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await createApiKey(req, req.body), "API key created. Store the key now; it will not be shown again.")));
const revokeKey = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await revokeApiKey(req, req.params.id), "API key revoked successfully.")));
const createHook = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await createWebhook(req, req.body), "Webhook created. Store the signing secret now; it will not be shown again.")));
const list = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await listIntegrations(req, req.params.organizationId), "Integrations fetched successfully.")));
const ping = (req, res) => res.status(200).json(new ApiResponse(200, { organizationId: req.apiClient.organizationId, scopes: req.apiClient.scopes }, "API key is valid."));
export { createHook, createKey, list, ping, revokeKey };
