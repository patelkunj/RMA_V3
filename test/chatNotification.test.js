import test from "node:test";
import assert from "node:assert/strict";
import {
    createChatNotifications,
    resolveChatNotificationRecipients,
} from "../src/services/notification.service.js";

const repairJob = {
    organizationId: 10,
    customerId: 20,
    createdBy: 30,
    receivedBy: 40,
};

test("internal chat messages notify the repair job customer", async () => {
    const recipients = await resolveChatNotificationRecipients({}, repairJob, "USER");

    assert.deepEqual(recipients, [{ recipientType: "CUSTOMER", recipientId: 20 }]);
});

test("customer chat messages select organization admins and related technicians", async () => {
    let receivedWhere;
    const db = {
        user: {
            findMany: async ({ where }) => {
                receivedWhere = where;
                return [{ id: 30 }, { id: 40 }, { id: 50 }];
            },
        },
    };

    const recipients = await resolveChatNotificationRecipients(db, repairJob, "CUSTOMER");

    assert.deepEqual(receivedWhere.OR, [
        {
            role: { in: ["ADMIN", "SUPER_ADMIN"] },
            userOrganizations: { some: { organizationId: 10 } },
        },
        {
            id: { in: [40, 30] },
            role: "TECHNICIAN",
        },
    ]);
    assert.deepEqual(recipients, [
        { recipientType: "USER", recipientId: 30 },
        { recipientType: "USER", recipientId: 40 },
        { recipientType: "USER", recipientId: 50 },
    ]);
});

test("customer chat messages still notify admins when no technician is related", async () => {
    let receivedWhere;
    const db = {
        user: {
            findMany: async ({ where }) => {
                receivedWhere = where;
                return [{ id: 50 }];
            },
        },
    };

    const recipients = await resolveChatNotificationRecipients(db, {
        ...repairJob,
        createdBy: null,
        receivedBy: null,
    }, "CUSTOMER");

    assert.equal(receivedWhere.OR.length, 1);
    assert.deepEqual(recipients, [{ recipientType: "USER", recipientId: 50 }]);
});

test("chat notifications are persisted internally without using the HTTP create route", async () => {
    let createdRows;
    const db = {
        user: {
            findMany: async () => [{ id: 40 }, { id: 50 }],
        },
        notification: {
            createMany: async ({ data }) => {
                createdRows = data;
                return { count: data.length };
            },
        },
    };

    const result = await createChatNotifications(db, {
        repairJob,
        chatId: 70,
        senderType: "CUSTOMER",
        senderRole: "CUSTOMER",
    });

    assert.deepEqual(result, { count: 2 });
    assert.deepEqual(createdRows, [
        {
            organizationId: 10,
            recipientType: "USER",
            recipientId: 40,
            referenceType: "CHAT",
            referenceId: 70,
            title: "New chat message",
            message: "New chat message from customer.",
        },
        {
            organizationId: 10,
            recipientType: "USER",
            recipientId: 50,
            referenceType: "CHAT",
            referenceId: 70,
            title: "New chat message",
            message: "New chat message from customer.",
        },
    ]);
});
