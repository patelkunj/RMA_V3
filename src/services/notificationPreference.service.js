import prisma from "../db/prisma.js";

const recipient = (req) => req.customer
    ? { recipientType: "CUSTOMER", recipientId: req.customer.id }
    : { recipientType: "USER", recipientId: req.user.id };

const getPreference = (req) => {
    const key = recipient(req);
    return prisma.notificationPreference.upsert({ where: { recipientType_recipientId: key }, create: key, update: {} });
};

const updatePreference = (req, payload) => {
    const key = recipient(req);
    return prisma.notificationPreference.upsert({
        where: { recipientType_recipientId: key },
        create: {
            ...key,
            emailEnabled: payload.emailEnabled !== false,
            inAppEnabled: payload.inAppEnabled !== false,
            digestEnabled: payload.digestEnabled === true,
            mutedEvents: Array.isArray(payload.mutedEvents) ? payload.mutedEvents.map(String) : [],
        },
        update: {
            emailEnabled: payload.emailEnabled,
            inAppEnabled: payload.inAppEnabled,
            digestEnabled: payload.digestEnabled,
            mutedEvents: Array.isArray(payload.mutedEvents) ? payload.mutedEvents.map(String) : undefined,
        },
    });
};

export { getPreference, updatePreference };
