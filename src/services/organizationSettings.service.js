import { ApiError } from "../utils/ApiError.js";
import { ensureUserCanAccessOrganization } from "../utils/accessControl.js";
import prisma from "../db/prisma.js";
import { taxRate as parseTaxRate } from "../utils/money.js";

const validateTimezone = (timezone) => {
    try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
        return timezone;
    } catch {
        throw new ApiError(400, "Invalid timezone.");
    }
};

const getSettings = async (req, organizationId) => {
    await ensureUserCanAccessOrganization(req.user, organizationId);
    return prisma.organizationSetting.upsert({
        where: { organizationId: Number(organizationId) },
        create: { organizationId: Number(organizationId) },
        update: {},
    });
};

const updateSettings = async (req, organizationId, payload) => {
    await ensureUserCanAccessOrganization(req.user, organizationId);
    const taxRate = payload.taxRate === undefined ? undefined : parseTaxRate(payload.taxRate);
    const defaultSlaHours = payload.defaultSlaHours === undefined ? undefined : Number(payload.defaultSlaHours);
    if (defaultSlaHours !== undefined && (!Number.isInteger(defaultSlaHours) || defaultSlaHours <= 0)) {
        throw new ApiError(400, "defaultSlaHours must be a positive integer.");
    }
    const currency = payload.currency ? String(payload.currency).trim().toUpperCase() : undefined;
    if (currency && !/^[A-Z]{3}$/.test(currency)) throw new ApiError(400, "currency must be an ISO 4217 code.");

    return prisma.organizationSetting.upsert({
        where: { organizationId: Number(organizationId) },
        create: {
            organizationId: Number(organizationId),
            timezone: payload.timezone ? validateTimezone(payload.timezone) : undefined,
            currency,
            taxRate,
            defaultSlaHours,
            businessHours: payload.businessHours,
            workflowConfiguration: payload.workflowConfiguration,
            branding: payload.branding,
        },
        update: {
            timezone: payload.timezone ? validateTimezone(payload.timezone) : undefined,
            currency,
            taxRate,
            defaultSlaHours,
            businessHours: payload.businessHours,
            workflowConfiguration: payload.workflowConfiguration,
            branding: payload.branding,
        },
    });
};

export { getSettings, updateSettings };
