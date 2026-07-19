import { createHash } from "crypto";
import { ApiError } from "../utils/ApiError.js";
import prisma from "../db/prisma.js";

const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    }
    return value;
};

const idempotent = ({ required = true, ttlHours = 24 } = {}) => async (req, res, next) => {
    try {
        const key = String(req.headers["idempotency-key"] || "").trim();
        if (!key) {
            if (required) throw new ApiError(400, "Idempotency-Key header is required.");
            return next();
        }
        if (key.length < 8 || key.length > 200) throw new ApiError(400, "Idempotency-Key must contain 8 to 200 characters.");

        const actor = req.user ? `USER:${req.user.id}` : req.customer ? `CUSTOMER:${req.customer.id}` : `IP:${req.ip}`;
        const requestHash = createHash("sha256")
            .update(JSON.stringify(stable({ method: req.method, path: req.originalUrl, body: req.body })))
            .digest("hex");
        const unique = { actorKey_idempotencyKey: { actorKey: actor, idempotencyKey: key } };
        let record = await prisma.idempotencyRecord.findUnique({ where: unique });
        if (record) {
            if (record.requestHash !== requestHash) throw new ApiError(409, "Idempotency key was already used for a different request.");
            if (record.responseBody) return res.status(record.statusCode || 200).json(record.responseBody);
            throw new ApiError(409, "An identical request is already being processed.");
        }
        try {
            record = await prisma.idempotencyRecord.create({
                data: { actorKey: actor, idempotencyKey: key, requestHash, expiresAt: new Date(Date.now() + ttlHours * 3600000) },
            });
        } catch (error) {
            if (error?.code === "P2002") throw new ApiError(409, "An identical request is already being processed.");
            throw error;
        }

        const originalJson = res.json.bind(res);
        res.json = async (body) => {
            await prisma.idempotencyRecord.update({
                where: { id: record.id },
                data: { statusCode: res.statusCode, responseBody: body },
            });
            return originalJson(body);
        };
        return next();
    } catch (error) {
        return next(error);
    }
};

export { idempotent };
