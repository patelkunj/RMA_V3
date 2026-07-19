import { isIP } from "net";
import { ApiError } from "../utils/ApiError.js";
import { ensureUserCanAccessOrganization } from "../utils/accessControl.js";
import { encryptSecret } from "../utils/encryption.js";
import { generateSecret, hashToken } from "../utils/tokenSecurity.js";
import prisma from "../db/prisma.js";

const validateWebhookUrl = (value) => {
    let url;
    try { url = new URL(value); } catch { throw new ApiError(400, "Invalid webhook URL."); }
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new ApiError(400, "Production webhook URLs must use HTTPS.");
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "0.0.0.0" || host === "::1") throw new ApiError(400, "Private webhook targets are not allowed.");
    if (isIP(host) && (/^(10\.|127\.|169\.254\.|192\.168\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host))) {
        throw new ApiError(400, "Private webhook targets are not allowed.");
    }
    return url.toString();
};

const createApiKey = async (req, payload) => {
    await ensureUserCanAccessOrganization(req.user, payload.organizationId);
    if (!String(payload.name || "").trim()) throw new ApiError(400, "name is required.");
    const secret = `rma_${generateSecret(32)}`;
    const record = await prisma.apiKey.create({
        data: {
            organizationId: Number(payload.organizationId),
            name: String(payload.name).trim(),
            keyPrefix: secret.slice(0, 12),
            keyHash: hashToken(secret),
            scopes: Array.isArray(payload.scopes) ? payload.scopes.map(String) : [],
            expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
            createdBy: req.user.id,
        },
        select: { id: true, organizationId: true, name: true, keyPrefix: true, scopes: true, expiresAt: true, createdDate: true },
    });
    return { ...record, key: secret };
};

const revokeApiKey = async (req, id) => {
    const record = await prisma.apiKey.findUnique({ where: { id: Number(id) } });
    if (!record) throw new ApiError(404, "API key not found.");
    await ensureUserCanAccessOrganization(req.user, record.organizationId);
    return prisma.apiKey.update({ where: { id: record.id }, data: { revokedAt: new Date() } });
};

const createWebhook = async (req, payload) => {
    await ensureUserCanAccessOrganization(req.user, payload.organizationId);
    const secret = generateSecret(32);
    const endpoint = await prisma.webhookEndpoint.create({
        data: {
            organizationId: Number(payload.organizationId),
            url: validateWebhookUrl(payload.url),
            secretCiphertext: encryptSecret(secret),
            events: Array.isArray(payload.events) ? payload.events.map(String) : [],
            createdBy: req.user.id,
        },
        select: { id: true, organizationId: true, url: true, events: true, isActive: true, createdDate: true },
    });
    return { ...endpoint, secret };
};

const listIntegrations = async (req, organizationId) => {
    await ensureUserCanAccessOrganization(req.user, organizationId);
    const [apiKeys, webhooks] = await Promise.all([
        prisma.apiKey.findMany({ where: { organizationId: Number(organizationId) }, select: { id: true, name: true, keyPrefix: true, scopes: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdDate: true } }),
        prisma.webhookEndpoint.findMany({ where: { organizationId: Number(organizationId) }, select: { id: true, url: true, events: true, isActive: true, failureCount: true, lastSuccessAt: true, createdDate: true } }),
    ]);
    return { apiKeys, webhooks };
};

export { createApiKey, createWebhook, listIntegrations, revokeApiKey, validateWebhookUrl };
