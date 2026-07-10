import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { generateAccessToken, generateRefreshToken } from "../utils/tokenHandler.js";
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

const cookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "Strict" : "Lax",
    maxAge: 3600000,
});

const refreshUserSession = async (refreshToken) => {
    if (!refreshToken) {
        throw new ApiError(401, "Refresh token is required.");
    }

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch {
        throw new ApiError(401, "Invalid or expired refresh token.");
    }

    const session = await prisma.sessionManagement.findFirst({
        where: {
            userId: Number(decoded.id),
            refreshToken,
            OR: [
                { expiresAt: null },
                { expiresAt: { gt: new Date() } },
            ],
        },
    });

    if (!session) {
        throw new ApiError(401, "Refresh session not found.");
    }

    const user = await prisma.user.findUnique({
        where: { id: Number(decoded.id) },
        select: publicUserSelect,
    });

    if (!user || !user.isActive || user.isLocked) {
        throw new ApiError(401, "Account is not active.");
    }

    const accessToken = generateAccessToken(user);
    const nextRefreshToken = generateRefreshToken(user);

    await prisma.sessionManagement.update({
        where: { id: session.id },
        data: {
            refreshToken: nextRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });

    return {
        user,
        accessToken,
        refreshToken: nextRefreshToken,
        cookieOptions: cookieOptions(),
    };
};

const listUserSessions = async (user) => {
    return prisma.sessionManagement.findMany({
        where: { userId: Number(user.id) },
        orderBy: { createdDate: "desc" },
        select: {
            id: true,
            userId: true,
            ipAddress: true,
            expiresAt: true,
            createdDate: true,
        },
    });
};

const revokeUserSession = async (user, sessionId) => {
    if (!sessionId) {
        throw new ApiError(400, "session id is required.");
    }

    const deleted = await prisma.sessionManagement.deleteMany({
        where: {
            id: Number(sessionId),
            userId: Number(user.id),
        },
    });

    if (deleted.count === 0) {
        throw new ApiError(404, "Session not found.");
    }

    return { revoked: deleted.count };
};

const revokeAllUserSessions = async (user) => {
    const deleted = await prisma.sessionManagement.deleteMany({
        where: { userId: Number(user.id) },
    });

    return { revoked: deleted.count };
};

export {
    listUserSessions,
    refreshUserSession,
    revokeAllUserSessions,
    revokeUserSession,
};
