import { randomUUID } from "crypto";
import fs from "fs";
import PDFDocument from "pdfkit";
import prisma from "../db/prisma.js";
import { ApiError } from "../utils/ApiError.js";
import {
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    isSuperAdmin,
} from "../utils/accessControl.js";
import { logger } from "../utils/logger.js";
import { assertValidEmail, normalizeEmail, parsePositiveInt, resolveActiveStatus } from "../utils/validation.js";
import { paginatedData } from "../utils/pagination.js";
import { deletePrivateObject, getPrivateObject, putPrivateObject } from "./objectStorage.service.js";

const LOGO_MIME_EXTENSIONS = new Map([
    ["image/png", ".png"],
    ["image/jpeg", ".jpg"],
]);

const organizationSelect = {
    id: true,
    name: true,
    alias: true,
    address: true,
    email: true,
    phone: true,
    isActive: true,
    logoFileName: true,
    logoMimeType: true,
    logoFileSize: true,
    logoFileHash: true,
    logoUpdatedAt: true,
    createdDate: true,
    updatedDate: true,
};

const toPublicOrganization = (organization) => {
    if (!organization) return null;
    const {
        logoFileName,
        logoMimeType,
        logoFileSize,
        logoFileHash,
        logoUpdatedAt,
        ...record
    } = organization;
    return {
        ...record,
        logo: logoFileName ? {
            url: `/api/v1/organizations/${organization.id}/logo`,
            mimeType: logoMimeType,
            size: logoFileSize,
            updatedAt: logoUpdatedAt,
        } : null,
    };
};

const normalizeOrganizationPayload = (payload, { partial = false } = {}) => {
    const name = payload.name === undefined ? undefined : String(payload.name).trim();
    const alias = payload.alias === undefined ? undefined : String(payload.alias).trim();
    if (!partial && (!name || !alias)) throw new ApiError(400, "Name and alias are required.");
    if (name !== undefined && !name) throw new ApiError(400, "Name cannot be empty.");
    if (alias !== undefined && !alias) throw new ApiError(400, "Alias cannot be empty.");

    let email;
    if (payload.email !== undefined) {
        email = normalizeEmail(payload.email) || null;
        if (email) assertValidEmail(email);
    }

    return {
        ...(name !== undefined ? { name } : {}),
        ...(alias !== undefined ? { alias } : {}),
        ...(payload.address !== undefined ? { address: String(payload.address || "").trim() || null } : {}),
        ...(payload.email !== undefined ? { email } : {}),
        ...(payload.phone !== undefined ? { phone: String(payload.phone || "").trim() || null } : {}),
        ...(payload.isActive !== undefined ? { isActive: payload.isActive === true || payload.isActive === "true" } : {}),
    };
};

const ensureOrganizationExistsAndAccessible = async (req, organizationId) => {
    const id = parsePositiveInt(organizationId, "organizationId");
    if (req.customer) {
        if (req.customer.organizationId !== id) throw new ApiError(404, "Organization not found.");
    } else {
        await ensureUserCanAccessOrganization(req.user, id);
    }
    const organization = await prisma.organization.findUnique({ where: { id }, select: organizationSelect });
    if (!organization) throw new ApiError(404, "Organization not found.");
    return organization;
};

const listOrganizations = async (req, filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
    const organizationIds = isSuperAdmin(req.user) ? [] : await getAssignedOrganizationIds(req.user);
    const where = isSuperAdmin(req.user) ? {} : { id: { in: organizationIds } };
    const [organizations, total] = await Promise.all([
        prisma.organization.findMany({
            where,
            select: organizationSelect,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { name: "asc" },
        }),
        prisma.organization.count({ where }),
    ]);
    return paginatedData(
        organizations.map(toPublicOrganization),
        { total, page, limit },
        "organizations",
    );
};

const createOrganization = async (req, payload) => {
    const data = normalizeOrganizationPayload(payload);
    const organization = await prisma.$transaction(async (tx) => {
        const record = await tx.organization.create({ data, select: organizationSelect });
        await tx.systemLog.create({
            data: {
                actorId: req.user.id,
                actorRole: req.user.role,
                description: `Organization ${record.id} created.`,
                logStatus: "Successful",
            },
        });
        return record;
    });
    return toPublicOrganization(organization);
};

const updateOrganizationRecord = async (req, payload) => {
    const id = parsePositiveInt(payload.id, "id");
    await ensureOrganizationExistsAndAccessible(req, id);
    const data = normalizeOrganizationPayload(payload, { partial: true });
    const organization = await prisma.organization.update({ where: { id }, data, select: organizationSelect });
    return toPublicOrganization(organization);
};

const toggleOrganizationStatus = async (req, organizationId, requestedStatus) => {
    const organization = await ensureOrganizationExistsAndAccessible(req, organizationId);
    const isActive = resolveActiveStatus(requestedStatus, {
        currentStatus: organization.isActive,
        isDeprecatedRoute: req.isDeprecatedRoute,
    });
    const updated = await prisma.organization.update({
        where: { id: organization.id },
        data: { isActive },
        select: organizationSelect,
    });
    return toPublicOrganization(updated);
};

const getOrganization = async (req, organizationId) => {
    return toPublicOrganization(await ensureOrganizationExistsAndAccessible(req, organizationId));
};

const removeFileSafely = async (filePath, metadata) => {
    if (!filePath) return;
    try {
        await fs.promises.unlink(filePath);
    } catch (error) {
        if (error.code !== "ENOENT") logger.warn("organization_logo_cleanup_failed", { ...metadata, error });
    }
};
const validateLogoImage = (filePath) => {
    const doc = new PDFDocument({ autoFirstPage: false });
    try {
        doc.openImage(filePath);
    } catch {
        throw new ApiError(415, "Organization logo is not a valid PNG or JPEG image.");
    } finally {
        doc.end();
    }
};

const uploadOrganizationLogo = async (req, organizationId, file) => {
    let storedKey;
    try {
        const organization = await ensureOrganizationExistsAndAccessible(req, organizationId);
        if (!file?.path) throw new ApiError(400, "Upload one logo using the 'logo' form field.");
        const extension = LOGO_MIME_EXTENSIONS.get(file.mimetype);
        if (!extension) throw new ApiError(415, "Organization logos must be PNG or JPEG images.");
        validateLogoImage(file.path);
        const fileName = `${randomUUID()}${extension}`;
        storedKey = `organizations/${organization.id}/branding/${fileName}`;
        const stored = await putPrivateObject({ key: storedKey, filePath: file.path, contentType: file.mimetype });

        let updated;
        try {
            updated = await prisma.$transaction(async (tx) => {
                const record = await tx.organization.update({
                    where: { id: organization.id },
                    data: {
                        logoFileName: stored.key,
                        logoMimeType: file.mimetype,
                        logoFileSize: stored.size,
                        logoFileHash: stored.hash,
                        logoUpdatedAt: new Date(),
                    },
                    select: organizationSelect,
                });
                await tx.systemLog.create({
                    data: {
                        actorId: req.user.id,
                        actorRole: req.user.role,
                        description: `Organization ${organization.id} logo updated.`,
                        logStatus: "Successful",
                    },
                });
                return record;
            });
        } catch (error) {
            await deletePrivateObject(storedKey).catch(() => {});
            throw error;
        }

        if (organization.logoFileName) {
            try {
                await deletePrivateObject(organization.logoFileName);
            } catch (error) {
                logger.warn("organization_previous_logo_cleanup_failed", { organizationId: organization.id, error });
            }
        }
        return toPublicOrganization(updated);
    } catch (error) {
        if (file?.path) await removeFileSafely(file.path, { organizationId: Number(organizationId) || null });
        throw error;
    }
};

const getOrganizationLogo = async (req, organizationId) => {
    const organization = await ensureOrganizationExistsAndAccessible(req, organizationId);
    if (!organization.logoFileName) throw new ApiError(404, "Organization logo not found.");
    let stored;
    try {
        stored = await getPrivateObject(organization.logoFileName);
    } catch (error) {
        logger.error("organization_logo_read_failed", { organizationId: organization.id, error });
        throw new ApiError(404, "Organization logo not found.");
    }
    const { buffer, hash } = stored;
    if (organization.logoFileHash && hash !== organization.logoFileHash) {
        logger.error("organization_logo_integrity_failed", { organizationId: organization.id });
        throw new ApiError(409, "Organization logo failed its integrity check.");
    }
    return {
        buffer,
        mimeType: organization.logoMimeType || "application/octet-stream",
        size: stored.size,
        etag: `\"${hash}\"`,
        updatedAt: organization.logoUpdatedAt,
    };
};

const removeOrganizationLogo = async (req, organizationId) => {
    const organization = await ensureOrganizationExistsAndAccessible(req, organizationId);
    if (!organization.logoFileName) return toPublicOrganization(organization);
    const previousKey = organization.logoFileName;
    const updated = await prisma.$transaction(async (tx) => {
        const record = await tx.organization.update({
            where: { id: organization.id },
            data: {
                logoFileName: null,
                logoMimeType: null,
                logoFileSize: null,
                logoFileHash: null,
                logoUpdatedAt: null,
            },
            select: organizationSelect,
        });
        await tx.systemLog.create({
            data: {
                actorId: req.user.id,
                actorRole: req.user.role,
                description: `Organization ${organization.id} logo removed.`,
                logStatus: "Successful",
            },
        });
        return record;
    });
    await deletePrivateObject(previousKey).catch(() => {});
    return toPublicOrganization(updated);
};

const loadOrganizationLogoForPdf = async (organization) => {
    if (!organization?.id || !organization.logoFileName) return null;
    try {
        const { buffer, hash } = await getPrivateObject(organization.logoFileName);
        if (organization.logoFileHash && organization.logoFileHash !== hash) {
            logger.error("organization_logo_integrity_failed", { organizationId: organization.id });
            return null;
        }
        return { buffer, mimeType: organization.logoMimeType };
    } catch (error) {
        logger.warn("organization_logo_pdf_fallback", { organizationId: organization.id, error });
        return null;
    }
};

export {
    createOrganization,
    getOrganization,
    getOrganizationLogo,
    listOrganizations,
    loadOrganizationLogoForPdf,
    removeOrganizationLogo,
    toPublicOrganization,
    toggleOrganizationStatus,
    updateOrganizationRecord,
    uploadOrganizationLogo,
};
