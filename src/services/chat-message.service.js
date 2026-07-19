import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { sendChatMessage } from "../services/chat.service.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { respondWithSafeError } from "../utils/safeError.js";
import { paginatedData } from "../utils/pagination.js";

const insertChat = asyncHandler(async (req, res) => {
    const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id;
    const { message } = req.body;

    if (!repairJobId) {
        throw new ApiError(400, "Repair job id is required.");
    }

    if (!message?.trim() && !req.files?.length) {
        throw new ApiError(400, "Message or attachment is required.");
    }

    const chat = await sendChatMessage(req, {
        repairJobId,
        message,
        files: req.files,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, chat, "Chat sent successfully."));
});

const listChat = asyncHandler(async (req, res) => {
    try {

        const id = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id || req.body.id;
        const page = Math.max(Number(req.query.page || req.body.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit || req.body.limit) || 100, 1), 100);

        if (!id) {
            throw new ApiError(400, "Job id is required.");
        }

        await ensureRepairJobAccess(req, id);

        // const chat = await prisma.chat.findMany({
        //     where: {
        //         repairJobId: Number(id)
        //     },
        //     orderBy: {
        //         createdDate: "asc"
        //     }
        // });

        const where = { repairJobId: Number(id) };
        const [chats, total] = await Promise.all([
            prisma.chat.findMany({
                where,
                orderBy: { createdDate: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.chat.count({ where }),
        ]);

        const chatWithSender = await Promise.all(
            chats.map(async (chat) => {

                let sender = null;

                if (chat.senderRole === "USER") {
                    sender = await prisma.user.findUnique({
                        where: { id: chat.senderId },
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    });
                } else {
                    sender = await prisma.customer.findUnique({
                        where: { id: chat.senderId },
                        select: {
                            id: true,
                            companyName: true,
                            contactPersonName: true
                        }
                    });
                }

                return {
                    ...chat,
                    sender
                };
            })
        );


        if (!chatWithSender.length) {
            return res
                .status(200)
                .json(new ApiResponse(
                    200,
                    req.isDeprecatedRoute ? [] : paginatedData([], { total, page, limit }, "chats"),
                    "No chat messages found.",
                ));
        }

        return res
            .status(200)
            .json(new ApiResponse(
                200,
                req.isDeprecatedRoute
                    ? chatWithSender
                    : paginatedData(chatWithSender, { total, page, limit }, "chats"),
                "Chat messages fetched successfully.",
            ));

    } catch (error) {
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "chat.list", "Unable to fetch chats.");
    }
});

const toggleRead = asyncHandler(async (req, res) => {
    try {

        const id = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id || req.body.id;

        if (!id) {
            throw new ApiError(400, "Job id is required.");
        }

        await ensureRepairJobAccess(req, id);

        const readData = await prisma.chat.updateMany({
            where: {
                repairJobId: Number(id),
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        if (readData.count === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        { count: 0 },
                        "All messages are already read."
                    )
                );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { count: readData.count },
                    `${readData.count} messages marked as read.`
                )
            );

    } catch (error) {
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "chat.mark-read", "Unable to update chat read status.");
    }
});

const unreadCount = asyncHandler(async (req, res) => {
    try {

        const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id;

        if (!repairJobId) {
            return res
                .status(400)
                .json(
                    new ApiError(
                        400,
                        "Repair job id is required."
                    )
                );
        }

        await ensureRepairJobAccess(req, repairJobId);

        const countUnread = await prisma.chat.count({
            where: {
                repairJobId: Number(repairJobId),
                isRead: false
            }
        });

        if (countUnread === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        { count: 0 },
                        "No unread messages."
                    )
                );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    { count: countUnread },
                    `${countUnread} unread message(s).`
                )
            );

    } catch (error) {
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "chat.unread-count", "Unable to fetch unread chat count.");
    }
});

export{
    insertChat,
    listChat,
    toggleRead,
    unreadCount
}
