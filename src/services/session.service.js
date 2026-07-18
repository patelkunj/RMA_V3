import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js";
import { hashToken } from "../utils/tokenSecurity.js";
import prisma from "../db/prisma.js";

const publicUserSelect = {
    id: true,
    firstName: true,
    lastName: true,
    email: true,
    mobile: true,
    role: true,
    isActive: true,
    isLocked: true,
    lastLoginAt: true,
    createdDate: true,
    updatedDate: true,
};

const publicCustomerSelect = {
    id: true,
    organizationId: true,
    companyName: true,
    customerCode: true,
    email: true,
    role: true,
    isActive: true,
    isLocked: true,
};

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
    maxAge: 60 * 60 * 1000,
    path: "/",
});
const refreshCookieOptions = () => ({ ...cookieOptions(), maxAge: 7 * 24 * 60 * 60 * 1000 });

const createSession = async ({ actor, refreshToken, ipAddress, userAgent, db = prisma }) => {
    const data = {
        refreshTokenHash: hashToken(refreshToken),
        ipAddress: ipAddress || null,
        userAgent: String(userAgent || "").slice(0, 500) || null,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    if (actor.role === "CUSTOMER") {
        return db.customerSession.create({ data: { customerId: actor.id, ...data } });
    }

    return db.sessionManagement.create({
        data: { userId: actor.id, refreshToken: null, ...data },
    });
};

const refreshUserSession = async (refreshToken) => {
    if (!refreshToken) throw new ApiError(401, "Refresh token is required.");

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, {
            issuer: process.env.JWT_ISSUER || "rma-backend",
            audience: process.env.JWT_AUDIENCE || "rma-api",
        });
    } catch {
        throw new ApiError(401, "Invalid or expired refresh token.");
    }

    const actorType = decoded.actorType || "USER";
    const refreshTokenHash = hashToken(refreshToken);
    const session = actorType === "CUSTOMER"
        ? await prisma.customerSession.findFirst({
            where: {
                customerId: Number(decoded.id),
                refreshTokenHash,
                revokedAt: null,
                expiresAt: { gt: new Date() },
            },
        })
        : await prisma.sessionManagement.findFirst({
            where: {
                userId: Number(decoded.id),
                revokedAt: null,
                OR: [{ refreshTokenHash }, { refreshToken }],
                AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
            },
        });

    if (!session) throw new ApiError(401, "Refresh session not found.");

    const actor = actorType === "CUSTOMER"
        ? await prisma.customer.findUnique({ where: { id: Number(decoded.id) }, select: publicCustomerSelect })
        : await prisma.user.findUnique({ where: { id: Number(decoded.id) }, select: publicUserSelect });

    if (!actor || !actor.isActive || actor.isLocked) throw new ApiError(401, "Account is not active.");

    const accessToken = generateAccessToken(actor);
    const nextRefreshToken = generateRefreshToken(actor);
    const sessionData = {
        refreshTokenHash: hashToken(nextRefreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        lastUsedAt: new Date(),
    };

    if (actorType === "CUSTOMER") {
        await prisma.customerSession.update({ where: { id: session.id }, data: sessionData });
    } else {
        await prisma.sessionManagement.update({
            where: { id: session.id },
            data: { ...sessionData, refreshToken: null },
        });
    }

    return {
        user: actor,
        accessToken,
        refreshToken: nextRefreshToken,
        cookieOptions: cookieOptions(),
        refreshCookieOptions: refreshCookieOptions(),
    };
};

const actorSessionModel = (actor) => actor.role === "CUSTOMER"
    ? { model: prisma.customerSession, key: { customerId: Number(actor.id) } }
    : { model: prisma.sessionManagement, key: { userId: Number(actor.id) } };

const listUserSessions = async (actor) => {
    const { model, key } = actorSessionModel(actor);
    return model.findMany({
        where: { ...key, revokedAt: null },
        orderBy: { createdDate: "desc" },
        select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            expiresAt: true,
            lastUsedAt: true,
            createdDate: true,
        },
    });
};

const revokeUserSession = async (actor, sessionId) => {
    if (!sessionId) throw new ApiError(400, "session id is required.");
    const { model, key } = actorSessionModel(actor);
    const result = await model.updateMany({
        where: { id: Number(sessionId), ...key, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    if (!result.count) throw new ApiError(404, "Session not found.");
    return { revoked: result.count };
};

const revokeAllUserSessions = async (actor) => {
    const { model, key } = actorSessionModel(actor);
    const result = await model.updateMany({
        where: { ...key, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    return { revoked: result.count };
};

export {
    createSession,
    listUserSessions,
    refreshUserSession,
    revokeAllUserSessions,
    revokeUserSession,
};
