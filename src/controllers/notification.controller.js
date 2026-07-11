import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    createManualNotification,
    listAllNotifications,
    listNotifications,
    markNotificationRead,
    unreadNotificationCount,
} from "../services/notification.service.js";

const listMine = asyncHandler(async (req, res) => {
    const data = await listNotifications(req, { ...req.query, ...req.body });
    return res.status(200).json(new ApiResponse(200, data, "Notifications fetched successfully."));
});

const listAll = asyncHandler(async (req, res) => {
    const data = await listAllNotifications(req, { ...req.query, ...req.body });
    return res.status(200).json(new ApiResponse(200, data, "Notifications fetched successfully."));
});

const createManual = asyncHandler(async (req, res) => {
    const notification = await createManualNotification(req, req.body);
    return res.status(201).json(new ApiResponse(201, notification, "Notification created successfully."));
});

const markRead = asyncHandler(async (req, res) => {
    const notification = await markNotificationRead(req, req.params.id || req.body.id, req.body.isRead ?? true);
    return res.status(200).json(new ApiResponse(200, notification, "Notification updated successfully."));
});

const unreadCount = asyncHandler(async (req, res) => {
    const count = await unreadNotificationCount(req);
    return res.status(200).json(new ApiResponse(200, { count }, "Unread notification count fetched successfully."));
});

export {
    createManual,
    listAll,
    listMine,
    markRead,
    unreadCount,
};
