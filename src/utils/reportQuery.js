import { ApiError } from "./ApiError.js";

const JOB_STATUSES = new Set([
    "CREATED",
    "RECEIVED",
    "IN_PROGRESS",
    "WAITING_PARTS",
    "COMPLETED",
    "CANCELLED",
]);

const RESOLUTION_TYPES = new Set([
    "REPLACEMENT",
    "REPAIR",
    "CREDIT",
]);

const toDateBoundary = (value, boundary) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new ApiError(400, "Invalid report date range.");
    }

    if (boundary === "end") {
        date.setHours(23, 59, 59, 999);
    } else {
        date.setHours(0, 0, 0, 0);
    }

    return date;
};

const addDays = (date, days) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return nextDate;
};

const diffDays = (startDate, endDate) => {
    const milliseconds = endDate.getTime() - startDate.getTime();
    return Math.ceil(milliseconds / (1000 * 60 * 60 * 24));
};

const parseReportDateRange = (source = {}, { defaultDays = 30, maxDays = 366 } = {}) => {
    const endDate = source.endDate
        ? toDateBoundary(source.endDate, "end")
        : toDateBoundary(new Date(), "end");

    const startDate = source.startDate
        ? toDateBoundary(source.startDate, "start")
        : toDateBoundary(addDays(endDate, -(defaultDays - 1)), "start");

    if (startDate > endDate) {
        throw new ApiError(400, "startDate must be before or equal to endDate.");
    }

    if (diffDays(startDate, endDate) > maxDays) {
        throw new ApiError(400, `Report date range cannot exceed ${maxDays} days.`);
    }

    return { startDate, endDate };
};

const parsePagination = (source = {}, { defaultLimit = 25, maxLimit = 100 } = {}) => {
    const page = Math.max(Number(source.page) || 1, 1);
    const limit = Math.min(Math.max(Number(source.limit) || defaultLimit, 1), maxLimit);

    return {
        page,
        limit,
        skip: (page - 1) * limit,
    };
};

const parseOptionalPositiveInt = (value, fieldName) => {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new ApiError(400, `${fieldName} must be a positive integer.`);
    }

    return parsed;
};

const parseJobStatus = (value) => {
    if (!value) return undefined;

    const status = String(value).trim().toUpperCase();

    if (!JOB_STATUSES.has(status)) {
        throw new ApiError(400, "Invalid repair job status.");
    }

    return status;
};

const parseResolutionType = (value) => {
    if (!value) return undefined;

    const resolutionType = String(value).trim().toUpperCase();

    if (!RESOLUTION_TYPES.has(resolutionType)) {
        throw new ApiError(400, "Invalid resolution type.");
    }

    return resolutionType;
};

const toNumber = (value) => Number(value ?? 0);

const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const average = (values) => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const daysBetween = (startDate, endDate = new Date()) => {
    if (!startDate) return null;
    return Math.max(diffDays(new Date(startDate), new Date(endDate)), 0);
};

const buildRepairJobReportWhere = (accessWhere, filters = {}, dateField = "createdDate") => {
    const reportWhere = {};

    if (filters.organizationId) {
        reportWhere.organizationId = filters.organizationId;
    }

    if (filters.customerId) {
        reportWhere.customerId = filters.customerId;
    }

    if (filters.status) {
        reportWhere.jobStatus = filters.status;
    }

    if (filters.resolutionType) {
        reportWhere.resolutionType = filters.resolutionType;
    }

    if (filters.startDate && filters.endDate) {
        reportWhere[dateField] = {
            gte: filters.startDate,
            lte: filters.endDate,
        };
    }

    const clauses = [accessWhere, reportWhere].filter((clause) => Object.keys(clause).length > 0);

    if (clauses.length === 0) return {};
    if (clauses.length === 1) return clauses[0];

    return { AND: clauses };
};

const parseReportFilters = (source = {}, options = {}) => {
    const dateRange = parseReportDateRange(source, options);

    return {
        ...dateRange,
        organizationId: parseOptionalPositiveInt(source.organizationId, "organizationId"),
        customerId: parseOptionalPositiveInt(source.customerId, "customerId"),
        status: parseJobStatus(source.status),
        resolutionType: parseResolutionType(source.resolutionType),
    };
};

export {
    average,
    buildRepairJobReportWhere,
    daysBetween,
    JOB_STATUSES,
    parseJobStatus,
    parseOptionalPositiveInt,
    parsePagination,
    parseReportDateRange,
    parseReportFilters,
    parseResolutionType,
    roundMoney,
    toNumber,
};
