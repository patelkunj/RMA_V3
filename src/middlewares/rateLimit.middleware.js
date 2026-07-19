import { ApiError } from "../utils/ApiError.js";
import prisma from "../db/prisma.js";

const buckets = new Map();

const getClientKey = (req) => {
    return req.ip || req.socket?.remoteAddress || "unknown";
};

const consumePostgresBucket = async (key, windowMs) => {
    const now = new Date();
    const resetAt = new Date(now.getTime() + windowMs);
    const rows = await prisma.$queryRaw`
        INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
        VALUES (${key}, 1, ${resetAt}, ${now})
        ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1 ELSE "RateLimitBucket"."count" + 1 END,
            "resetAt" = CASE WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimitBucket"."resetAt" END,
            "updatedAt" = ${now}
        RETURNING "count", "resetAt"
    `;
    return rows[0];
};

const rateLimit = ({ windowMs = 60_000, max = 60, keyPrefix = "global" } = {}) => {
    return (req, res, next) => {
        const now = Date.now();
        const key = `${keyPrefix}:${getClientKey(req)}`;
        if (process.env.RATE_LIMIT_STORE === "postgres") {
            consumePostgresBucket(key, windowMs)
                .then((bucket) => {
                    const remaining = Math.max(max - bucket.count, 0);
                    res.setHeader("RateLimit-Limit", max);
                    res.setHeader("RateLimit-Remaining", remaining);
                    res.setHeader("RateLimit-Reset", Math.ceil(new Date(bucket.resetAt).getTime() / 1000));
                    if (bucket.count > max) {
                        res.setHeader("Retry-After", Math.ceil((new Date(bucket.resetAt).getTime() - now) / 1000));
                        return res.status(429).json(new ApiError(429, "Too many requests. Please try again later."));
                    }
                    return next();
                })
                .catch(next);
            return;
        }
        const current = buckets.get(key);

        if (!current || current.resetAt <= now) {
            buckets.set(key, { count: 1, resetAt: now + windowMs });
            res.setHeader("RateLimit-Limit", max);
            res.setHeader("RateLimit-Remaining", Math.max(max - 1, 0));
            res.setHeader("RateLimit-Reset", Math.ceil((now + windowMs) / 1000));
            return next();
        }

        current.count += 1;
        res.setHeader("RateLimit-Limit", max);
        res.setHeader("RateLimit-Remaining", Math.max(max - current.count, 0));
        res.setHeader("RateLimit-Reset", Math.ceil(current.resetAt / 1000));

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
