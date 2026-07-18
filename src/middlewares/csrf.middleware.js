import { ApiError } from "../utils/ApiError.js";
import { safeEqual } from "../utils/tokenSecurity.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const verifyCsrf = (req, res, next) => {
    if (SAFE_METHODS.has(req.method) || !req.cookies?.accessToken) return next();
    const cookieToken = req.cookies.csrfToken;
    const headerToken = req.headers["x-csrf-token"];
    if (!cookieToken || !headerToken || !safeEqual(cookieToken, headerToken)) {
        return res.status(403).json(new ApiError(403, "CSRF token is missing or invalid."));
    }
    return next();
};

export { verifyCsrf };
