const SENSITIVE_QUERY_KEYS = new Set(["token", "accessToken", "refreshToken", "code", "password"]);

const sanitizeRequestPath = (value = "") => {
    try {
        const url = new URL(value, "http://localhost");
        for (const key of [...url.searchParams.keys()]) {
            if (SENSITIVE_QUERY_KEYS.has(key)) url.searchParams.set(key, "[REDACTED]");
        }
        url.pathname = url.pathname
            .replace(/\/(activeuser|activecustomer|forgetPassword)\/[^/]+/gi, "/$1/[REDACTED]");
        return `${url.pathname}${url.search}`;
    } catch {
        return String(value).split("?")[0];
    }
};

export { sanitizeRequestPath };
