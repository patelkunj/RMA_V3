import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    listUserSessions,
    refreshUserSession,
    revokeAllUserSessions,
    revokeUserSession,
} from "../services/session.service.js";
import { exposeTokensInResponse, generateSecret } from "../utils/tokenSecurity.js";

const refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    const session = await refreshUserSession(refreshToken);
    const csrfToken = generateSecret(24);

    return res
        .status(200)
        .cookie("accessToken", session.accessToken, session.cookieOptions)
        .cookie("refreshToken", session.refreshToken, session.refreshCookieOptions)
        .cookie("csrfToken", csrfToken, { ...session.cookieOptions, httpOnly: false })
        .json(new ApiResponse(200, {
            user: session.user,
            csrfToken,
            ...(exposeTokensInResponse() ? {
                accessToken: session.accessToken,
                refreshToken: session.refreshToken,
            } : {}),
        }, "Token refreshed successfully."));
});

const list = asyncHandler(async (req, res) => {
    const sessions = await listUserSessions(req.user || req.customer);
    return res.status(200).json(new ApiResponse(200, sessions, "Sessions fetched successfully."));
});

const revoke = asyncHandler(async (req, res) => {
    const result = await revokeUserSession(req.user || req.customer, req.params.id || req.body.id);
    return res.status(200).json(new ApiResponse(200, result, "Session revoked successfully."));
});

const revokeAll = asyncHandler(async (req, res) => {
    const result = await revokeAllUserSessions(req.user || req.customer);
    return res.status(200).json(new ApiResponse(200, result, "Sessions revoked successfully."));
});

export {
    list,
    refresh,
    revoke,
    revokeAll,
};
