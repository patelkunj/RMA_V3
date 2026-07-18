import { randomUUID } from "crypto";
import { logger } from "../utils/logger.js";
import { sanitizeRequestPath } from "../utils/requestSanitizer.js";

const getClientIp = (req) => {
    return req.ip || req.socket?.remoteAddress || "unknown";
};

const getActor = (req) => {
    if (req.user) {
        return {
            type: "USER",
            id: req.user.id,
            role: req.user.role,
            email: req.user.email,
        };
    }

    if (req.customer) {
        return {
            type: "CUSTOMER",
            id: req.customer.id,
            role: req.customer.role,
            email: req.customer.email,
            organizationId: req.customer.organizationId,
        };
    }

    return {
        type: "ANONYMOUS",
    };
};

const activityLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const requestId = req.headers["x-request-id"] || randomUUID();

    req.id = Array.isArray(requestId) ? requestId[0] : requestId;
    res.setHeader("X-Request-Id", req.id);

    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
        const statusCode = res.statusCode;
        const level = statusCode >= 500 ? "error" : statusCode >= 400 ? "warn" : "info";

        logger[level]("http_request", {
            requestId: req.id,
            method: req.method,
            path: sanitizeRequestPath(req.originalUrl || req.url),
            statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: getClientIp(req),
            userAgent: req.headers["user-agent"],
            contentLength: res.getHeader("content-length") || null,
            actor: getActor(req),
        });
    });

    next();
};

export { activityLogger };
