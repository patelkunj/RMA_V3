import { ApiError } from "../utils/ApiError.js";

const buckets = new Map();

const getClientKey = (req) => {
    const forwardedFor = req.headers["x-forwarded-for"];
    const ip = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : forwardedFor?.split(",")[0]?.trim();

    return ip || req.ip || req.socket?.remoteAddress || "unknown";
};

const rateLimit = ({ windowMs = 60_000, max = 60, keyPrefix = "global" } = {}) => {
    return (req, res, next) => {
        const now = Date.now();
        const key = `${keyPrefix}:${getClientKey(req)}`;
        const current = buckets.get(key);

        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }

        current.count += 1;

        if (current.count > max) {
            res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
            return res.status(429).json(new ApiError(429, "Too many requests. Please try again later."));
        }

        return next();
    };
};

const cleanupInterval = setInterval(() => {
    const now = Date.now();

    for (const [key, value] of buckets.entries()) {
        if (value.resetAt <= now) {
            buckets.delete(key);
        }
    }
}, 60_000);

cleanupInterval.unref?.();

const authRateLimit = rateLimit({
    windowMs: 15 * 60_000,
    max: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
    keyPrefix: "auth",
});

const apiRateLimit = rateLimit({
    windowMs: 60_000,
    max: Number(process.env.API_RATE_LIMIT_MAX || 300),
    keyPrefix: "api",
});

const uploadRateLimit = rateLimit({
    windowMs: 15 * 60_000,
    max: Number(process.env.UPLOAD_RATE_LIMIT_MAX || 30),
    keyPrefix: "upload",
});

export {
    apiRateLimit,
    authRateLimit,
    rateLimit,
    uploadRateLimit,
};
