import { ApiError } from "./ApiError.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const assertValidEmail = (email) => {
    if (!EMAIL_REGEX.test(String(email || "").trim())) {
        throw new ApiError(400, "A valid email address is required.");
    }
};

const assertStrongPassword = (password) => {
    const value = String(password || "");

    if (value.length < 10) {
        throw new ApiError(400, "Password must be at least 10 characters long.");
    }

    if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[0-9]/.test(value)) {
        throw new ApiError(400, "Password must include uppercase, lowercase, and number characters.");
    }
};

const parsePositiveInt = (value, fieldName) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ApiError(400, `${fieldName} must be a positive integer.`);
    }

    return parsed;
};

const parseOptionalBoolean = (value, fieldName = "value") => {
    if (value === undefined) return undefined;
    if (value === true || value === false) return value;
    if (value === "true") return true;
    if (value === "false") return false;
    throw new ApiError(400, `${fieldName} must be a boolean.`);
};

const resolveActiveStatus = (value, { currentStatus, isDeprecatedRoute = false } = {}) => {
    const parsedStatus = parseOptionalBoolean(value, "isActive");
    if (parsedStatus !== undefined) return parsedStatus;
    if (!isDeprecatedRoute) throw new ApiError(400, "isActive is required.");
    return !currentStatus;
};

export {
    assertStrongPassword,
    assertValidEmail,
    normalizeEmail,
    parseOptionalBoolean,
    parsePositiveInt,
    resolveActiveStatus,
};
