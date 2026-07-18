import { asyncHandler } from "../utils/asyncHandler.js";
import { liveness, readiness } from "../services/health.service.js";
import { renderMetrics } from "../utils/metrics.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { processOutboxBatch } from "../services/outbox.service.js";
import { processSlaBreaches } from "../services/sla.service.js";

const live = (req, res) => res.status(200).json(liveness());

const ready = asyncHandler(async (req, res) => {
    try {
        return res.status(200).json(await readiness());
    } catch {
        return res.status(503).json({ status: "not_ready", timestamp: new Date().toISOString() });
    }
});

const metrics = (req, res) => {
    const configuredToken = process.env.METRICS_TOKEN;
    if (configuredToken && req.headers.authorization !== `Bearer ${configuredToken}`) {
        throw new ApiError(401, "Metrics credentials are invalid.");
    }
    res.type("text/plain; version=0.0.4");
    return res.status(200).send(renderMetrics());
};

const processOutbox = asyncHandler(async (req, res) => {
    const result = await processOutboxBatch({ limit: Math.min(Number(req.body.limit) || 20, 100) });
    return res.status(200).json(new ApiResponse(200, result, "Outbox batch processed successfully."));
});
const processSla = asyncHandler(async (req, res) => {
    const result = await processSlaBreaches(Math.min(Number(req.body.limit) || 100, 500));
    return res.status(200).json(new ApiResponse(200, result, "SLA breach batch processed successfully."));
});

export { live, metrics, processOutbox, processSla, ready };
