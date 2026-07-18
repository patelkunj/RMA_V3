import { ApiError } from "../utils/ApiError.js";

const readBoolean = (name, fallback = false) => {
    const value = process.env[name];
    if (value === undefined) return fallback;
    return value === "true" || value === "1";
};

const readPositiveInt = (name, fallback) => {
    const value = Number(process.env[name] ?? fallback);
    if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer.`);
    }
    return value;
};

const readTaxRate = (value = process.env.TAX_RATE) => {
    const parsed = Number(value ?? 0.15);
    if (!Number.isFinite(parsed) || parsed < 0) {
        throw new ApiError(500, "TAX_RATE must be a non-negative number.");
    }

    const normalized = parsed > 1 ? parsed / 100 : parsed;
    if (normalized > 1) {
        throw new ApiError(500, "TAX_RATE must be a fraction or percentage no greater than 100%.");
    }
    return normalized;
};

const validateUrl = (name, value) => {
    try {
        return new URL(value).toString();
    } catch {
        throw new Error(`${name} must be a valid URL.`);
    }
};

const validateEnvironment = () => {
    const isProduction = process.env.NODE_ENV === "production";
    const required = ["DATABASE_URL", "ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"];
    if (isProduction) required.push("CORS_ORIGIN", "APP_URL", "DEVICE_DATA_ENCRYPTION_KEY", "WEBHOOK_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY", "METRICS_TOKEN");

    const missing = required.filter((name) => !String(process.env[name] || "").trim());
    if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(", ")}`);

    const uploadProvider = String(process.env.UPLOAD_STORAGE_PROVIDER || "local").trim().toLowerCase();
    if (!["local", "s3"].includes(uploadProvider)) throw new Error("UPLOAD_STORAGE_PROVIDER must be local or s3.");
    if (uploadProvider === "s3") {
        const objectStorageMissing = ["OBJECT_STORAGE_BUCKET", "OBJECT_STORAGE_REGION"]
            .filter((name) => !String(process.env[name] || "").trim());
        if (objectStorageMissing.length) throw new Error(`Missing required object storage variables: ${objectStorageMissing.join(", ")}`);
        const hasAccessKey = Boolean(String(process.env.OBJECT_STORAGE_ACCESS_KEY_ID || "").trim());
        const hasSecretKey = Boolean(String(process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY || "").trim());
        if (hasAccessKey !== hasSecretKey) throw new Error("Object storage access key and secret must be configured together.");
        if (process.env.OBJECT_STORAGE_ENDPOINT) validateUrl("OBJECT_STORAGE_ENDPOINT", process.env.OBJECT_STORAGE_ENDPOINT);
    }

    if (isProduction) {
        if (uploadProvider !== "s3") {
            throw new Error("UPLOAD_STORAGE_PROVIDER must be s3 in production so private uploads are shared across instances.");
        }
        for (const name of ["ACCESS_TOKEN_SECRET", "REFRESH_TOKEN_SECRET"]) {
            if (String(process.env[name]).length < 32) {
                throw new Error(`${name} must contain at least 32 characters in production.`);
            }
        }
        validateUrl("APP_URL", process.env.APP_URL);
        for (const origin of process.env.CORS_ORIGIN.split(",").map((item) => item.trim())) {
            validateUrl("CORS_ORIGIN", origin);
        }
        if (process.env.RATE_LIMIT_STORE !== "postgres") {
            throw new Error("RATE_LIMIT_STORE must be postgres in production.");
        }
        if (process.env.FILE_SCAN_REQUIRED !== "false" && !process.env.CLAMAV_HOST) {
            throw new Error("CLAMAV_HOST is required when production file scanning is enabled.");
        }
        if (process.env.LOG_TO_FILE === "true") {
            throw new Error("LOG_TO_FILE must be false in production; use centralized stdout log collection.");
        }
    }

    readTaxRate();
    readPositiveInt("PORT", 3000);
    readPositiveInt("SHUTDOWN_TIMEOUT_MS", 10000);

    return {
        isProduction,
        port: readPositiveInt("PORT", 3000),
        trustProxy: readBoolean("TRUST_PROXY"),
        shutdownTimeoutMs: readPositiveInt("SHUTDOWN_TIMEOUT_MS", 10000),
    };
};

export {
    readBoolean,
    readPositiveInt,
    readTaxRate,
    validateEnvironment,
};
