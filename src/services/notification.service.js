import { ApiError } from "../utils/ApiError.js";
import {
    ensureUserCanAccessOrganization,
    isSuperAdmin,
} from "../utils/accessControl.js";
import prisma from "../db/prisma.js";
import { parsePositiveInt } from "../utils/validation.js";

const RECIPIENT_TYPES = new Set(["USER", "CUSTOMER"]);
const REFERENCE_TYPES = new Set(["CHAT", "REPAIR_JOB"]);

const normalizeEnumValue = (value, allowedValues, fieldName) => {
    const normalized = String(value ?? "").trim().toUpperCase();

    if (!allowedValues.has(normalized)) {
        throw new ApiError(400, `Invalid ${fieldName}.`);
    }

    return normalized;
};

const recipientForRequest = (req) => {
    if (req.customer) {
        return {
            recipientType: "CUSTOMER",
            recipientId: req.customer.id,
            organizationId: req.customer.organizationId,
        };
    }

    return {
        recipientType: "USER",
        recipientId: req.user.id,
    };
};

const resolveChatNotificationRecipients = async (db, repairJob, senderType) => {
    if (senderType === "USER") {
        return [{ recipientType: "CUSTOMER", recipientId: repairJob.customerId }];
    }

    const relatedTechnicianIds = [...new Set([
        repairJob.receivedBy,
        repairJob.createdBy,
    ].filter(Boolean))];

    const users = await db.user.findMany({
        where: {
            isActive: true,
            isLocked: false,
            OR: [
                {
                    role: { in: ["ADMIN", "SUPER_ADMIN"] },
                    userOrganizations: {
                        some: { organizationId: repairJob.organizationId },
                    },
                },
                ...(relatedTechnicianIds.length ? [{
                    id: { in: relatedTechnicianIds },
                    role: "TECHNICIAN",
                }] : []),
            ],
        },
        select: { id: true },
    });

    return users.map((user) => ({ recipientType: "USER", recipientId: user.id }));
};

const createChatNotifications = async (db, {
    repairJob,
    chatId,
    senderType,
    senderRole,
}) => {
    const recipients = await resolveChatNotificationRecipients(db, repairJob, senderType);

    if (!recipients.length) return { count: 0 };

    const senderLabel = String(senderRole || senderType).toLowerCase();

    return db.notification.createMany({
        data: recipients.map((recipient) => ({
            organizationId: repairJob.organizationId,
            ...recipient,
            referenceType: "CHAT",
            referenceId: chatId,
            title: "New chat message",
            message: `New chat message from ${senderLabel}.`,
        })),
    });
};

const listNotifications = async (req, filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const recipient = recipientForRequest(req);
    const where = {
        recipientType: recipient.recipientType,
        recipientId: recipient.recipientId,
        ...(req.customer ? { organizationId: recipient.organizationId } : {}),
        ...(filters.isRead === false ? {} : { isRead: filters.isRead === false || filters.isRead === "false" }),
        //...(filters.isRead === undefined ? {} : { isRead: filters.isRead === true || filters.isRead === "true" }),
    };

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdDate: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.notification.count({ where }),
    ]);

    return {
        notifications,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
};

const createManualNotification = async (req, payload) => {
    const {
        organizationId,
        recipientType,
        recipientId,
        referenceType,
        referenceId,
        title,
        message,
    } = payload;

    if ([organizationId, recipientType, recipientId, referenceType, referenceId, title, message]
        .some((field) => String(field ?? "").trim() === "")) {
        throw new ApiError(400, "All fields are required.");
    }

    const normalizedOrganizationId = parsePositiveInt(organizationId, "organizationId");
    const normalizedRecipientId = parsePositiveInt(recipientId, "recipientId");
    const normalizedReferenceId = parsePositiveInt(referenceId, "referenceId");
    const normalizedRecipientType = normalizeEnumValue(
        recipientType,
        RECIPIENT_TYPES,
        "recipient type"
    );
    const normalizedReferenceType = normalizeEnumValue(
        referenceType,
        REFERENCE_TYPES,
        "reference type"
    );

    await ensureUserCanAccessOrganization(req.user, normalizedOrganizationId);

    const recipientExists = normalizedRecipientType === "CUSTOMER"
        ? await prisma.customer.findFirst({
            where: {
                id: normalizedRecipientId,
                organizationId: normalizedOrganizationId,
            },
            select: { id: true },
        })
        : await prisma.user.findFirst({
            where: {
                id: normalizedRecipientId,
                userOrganizations: {
                    some: { organizationId: normalizedOrganizationId },
                },
            },
            select: { id: true },
        });

    if (!recipientExists) {
        throw new ApiError(404, "Notification recipient not found.");
    }

    const referenceExists = normalizedReferenceType === "CHAT"
        ? await prisma.chat.findFirst({
            where: {
                id: normalizedReferenceId,
                repairJob: { organizationId: normalizedOrganizationId },
            },
            select: { id: true },
        })
        : await prisma.repairJob.findFirst({
            where: {
                id: normalizedReferenceId,
                organizationId: normalizedOrganizationId,
            },
            select: { id: true },
        });

    if (!referenceExists) {
        throw new ApiError(404, "Notification reference not found.");
    }

    return prisma.notification.create({
        data: {
            organizationId: normalizedOrganizationId,
            recipientType: normalizedRecipientType,
            recipientId: normalizedRecipientId,
            referenceType: normalizedReferenceType,
            referenceId: normalizedReferenceId,
            title: String(title).trim(),
            message: String(message).trim(),
        },
    });
};

const markNotificationRead = async (req, notificationId, isRead = true) => {
    if (!notificationId) {
        throw new ApiError(400, "notification id is required.");
    }

    const normalizedNotificationId = parsePositiveInt(notificationId, "notification id");
    const recipient = recipientForRequest(req);
    const notification = await prisma.notification.findFirst({
        where: {
            id: normalizedNotificationId,
            recipientType: recipient.recipientType,
            recipientId: recipient.recipientId,
            ...(req.customer ? { organizationId: recipient.organizationId } : {}),
        },
    });

    if (!notification) {
        throw new ApiError(404, "Notification not found.");
    }

    return prisma.notification.update({
        where: { id: notification.id },
        data: { isRead: isRead === true || isRead === "true" },
    });
};

const unreadNotificationCount = async (req) => {
    const recipient = recipientForRequest(req);

    return prisma.notification.count({
        where: {
            recipientType: recipient.recipientType,
            recipientId: recipient.recipientId,
            isRead: false,
            ...(req.customer ? { organizationId: recipient.organizationId } : {}),
        },
    });
};

const listAllNotifications = async (req, filters = {}) => {
    if (!isSuperAdmin(req.user) && !filters.organizationId) {
        throw new ApiError(400, "organizationId is required.");
    }

    const organizationId = filters.organizationId
        ? parsePositiveInt(filters.organizationId, "organizationId")
        : undefined;

    if (organizationId) await ensureUserCanAccessOrganization(req.user, organizationId);

    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const where = {
        ...(organizationId ? { organizationId } : {}),
    };

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            where,
            orderBy: { createdDate: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.notification.count({ where }),
    ]);

    return { notifications, total, page, limit, totalPages: Math.ceil(total / limit) };
};

export {
    createChatNotifications,
    createManualNotification,
    listAllNotifications,
    listNotifications,
    markNotificationRead,
    resolveChatNotificationRecipients,
    unreadNotificationCount,
};
