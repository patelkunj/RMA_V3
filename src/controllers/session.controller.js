import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    listUserSessions,
    refreshUserSession,
    revokeAllUserSessions,
    revokeUserSession,
} from "../services/session.service.js";

const refresh = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    const session = await refreshUserSession(refreshToken);

    return res
        .status(200)
        .cookie("accessToken", session.accessToken, session.cookieOptions)
        .cookie("refreshToken", session.refreshToken, session.cookieOptions)
        .json(new ApiResponse(200, {
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
        }, "Token refreshed successfully."));
});

const list = asyncHandler(async (req, res) => {
    const sessions = await listUserSessions(req.user);
    return res.status(200).json(new ApiResponse(200, sessions, "Sessions fetched successfully."));
});

const revoke = asyncHandler(async (req, res) => {
    const result = await revokeUserSession(req.user, req.params.id || req.body.id);
    return res.status(200).json(new ApiResponse(200, result, "Session revoked successfully."));
});

const revokeAll = asyncHandler(async (req, res) => {
    const result = await revokeAllUserSessions(req.user);
    return res.status(200).json(new ApiResponse(200, result, "Sessions revoked successfully."));
});

export {
    list,
    refresh,
    revoke,
    revokeAll,
};
