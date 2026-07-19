import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hashToken } from "../utils/tokenSecurity.js";
import prisma from "../db/prisma.js";

const verifyApiKey = asyncHandler(async (req, res, next) => {
    const value = req.headers["x-api-key"];
    if (!value) throw new ApiError(401, "API key is required.");
    const key = await prisma.apiKey.findFirst({
        where: { keyHash: hashToken(value), revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
    if (!key) throw new ApiError(401, "API key is invalid or expired.");
    await prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    req.apiClient = { id: key.id, organizationId: key.organizationId, scopes: key.scopes };
    next();
});

export { verifyApiKey };
