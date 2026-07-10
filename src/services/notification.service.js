import { ApiError } from "../utils/ApiError.js";
import {
    ensureUserCanAccessOrganization,
    isSuperAdmin,
} from "../utils/accessControl.js";
import prisma from "../db/prisma.js";

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

const listNotifications = async (req, filters = {}) => {
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const recipient = recipientForRequest(req);
    const where = {
        recipientType: recipient.recipientType,
        recipientId: recipient.recipientId,
        ...(filters.isRead === undefined ? {} : { isRead: filters.isRead === true || filters.isRead === "true" }),
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

const createNotification = async (req, payload) => {
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

    await ensureUserCanAccessOrganization(req.user, organizationId);

    const normalizedRecipientType = String(recipientType).trim().toUpperCase();
    if (!["USER", "CUSTOMER"].includes(normalizedRecipientType)) {
        throw new ApiError(400, "Invalid recipient type.");
    }

    return prisma.notification.create({
        data: {
            organizationId: Number(organizationId),
            recipientType: normalizedRecipientType,
            recipientId: Number(recipientId),
            referenceType: String(referenceType).trim(),
            referenceId: Number(referenceId),
            title: String(title).trim(),
            message: String(message).trim(),
        },
    });
};

const markNotificationRead = async (req, notificationId, isRead = true) => {
    if (!notificationId) {
        throw new ApiError(400, "notification id is required.");
    }

    const recipient = recipientForRequest(req);
    const notification = await prisma.notification.findFirst({
        where: {
            id: Number(notificationId),
            recipientType: recipient.recipientType,
            recipientId: recipient.recipientId,
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

    if (filters.organizationId) {
        await ensureUserCanAccessOrganization(req.user, filters.organizationId);
    }

    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 25, 1), 100);
    const where = {
        ...(filters.organizationId ? { organizationId: Number(filters.organizationId) } : {}),
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
    createNotification,
    listAllNotifications,
    listNotifications,
    markNotificationRead,
    unreadNotificationCount,
};
