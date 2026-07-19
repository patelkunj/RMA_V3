const DEFAULT_DEPRECATION = "Sat, 18 Jul 2026 00:00:00 GMT";
const DEFAULT_SUNSET = "Sun, 31 Jan 2027 00:00:00 GMT";

const readDate = (configuredValue, fallback) => {
    const configured = String(configuredValue || fallback).trim();
    const parsed = new Date(configured);
    return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed;
};

const readDeprecation = () => `@${Math.floor(readDate(process.env.LEGACY_API_DEPRECATION, DEFAULT_DEPRECATION).getTime() / 1000)}`;
const readSunset = () => readDate(process.env.LEGACY_API_SUNSET, DEFAULT_SUNSET).toUTCString();
const safeSuccessor = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const successor = String(value);
    if (!successor.startsWith("/") || successor.length > 2048 || /[^\x21-\x7e]|[<>"\\{}]/.test(successor)) return null;
    return successor;
};

const deprecateRoute = (replacement) => function deprecatedRoute(req, res, next) {
    const successor = safeSuccessor(typeof replacement === "function" ? replacement(req) : replacement);
    req.isDeprecatedRoute = true;
    res.setHeader("Deprecation", readDeprecation());
    res.setHeader("Sunset", readSunset());
    if (successor) {
        res.setHeader("Link", `<${successor}>; rel="successor-version"`);
        res.setHeader("Warning", `299 - "Deprecated API route; use ${successor}"`);
    } else {
        res.removeHeader?.("Link");
        res.setHeader("Warning", "299 - \"Deprecated API route\"");
    }
    return next();
};

const replacePathPrefix = (legacyPrefix, canonicalPrefix) => (req) =>
    String(req.originalUrl || req.url || "").replace(legacyPrefix, canonicalPrefix);

export { deprecateRoute, replacePathPrefix };
