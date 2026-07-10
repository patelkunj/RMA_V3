import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { moveUploadedFiles } from "../utils/fileUpload.js";
import { generateRandomString } from "../utils/common.js";

const getDocumentType = (fileName) => {
    const extension = fileName.toLowerCase();

    if (
        extension.endsWith(".jpg") ||
        extension.endsWith(".jpeg") ||
        extension.endsWith(".png") ||
        extension.endsWith(".webp")
    ) {
        return "IMAGE";
    }

    if (extension.endsWith(".pdf")) {
        return "PDF";
    }

    if (extension.endsWith(".doc") || extension.endsWith(".docx")) {
        return "DOC";
    }

    return "OTHER";
};

const insertChat = asyncHandler(async (req, res) => {
    try {

        const { repair_job_id, message } = req.body;

        if (!repair_job_id) {
            throw new ApiError(400, "Repair job id is required.");
        }

        if (!message?.trim() && !req.files?.length) {
            throw new ApiError(400, "Message or attachment is required.");
        }

        const senderId = req.user?.id || req.customer?.id;
        const senderRole = req.user?.id ? "USER" : "CUSTOMER";

        if (!senderId) {
            throw new ApiError(401, "Unauthorized sender.");
        }

        const repairJob = await prisma.repairJob.findUnique({
            where: { id: Number(repair_job_id) },
            select: { id: true },
        });

        if (!repairJob) {
            throw new ApiError(404, "Repair job not found.");
        }

        let chat = null;

        if (message?.trim()) {

            chat = await prisma.chat.create({
                data: {
                    repairJobId: Number(repair_job_id),
                    senderId,
                    senderRole,
                    message: message.trim()
                }
            });

            if (!chat) {
                throw new ApiError(400, "Chat couldn't be inserted.");
            }
        }

        if (req.files?.length > 0) {

            const uploadFiles = await moveUploadedFiles(req.files, repair_job_id, "chat");

            for (const file of uploadFiles) {
                await prisma.document.create({
                    data: {
                        repairJobId: Number(repair_job_id),
                        relatedType: "chat",
                        relatedId: chat?.id || 0,
                        documentName: file,
                        documentUrl: `/uploads/${repair_job_id}/chat/${file}`,
                        documentType: getDocumentType(file),
                        uploadedBy: senderId,
                        uploadedRole: req.user?.role || req.customer?.role,
                        fileHash: generateRandomString(15)
                    }
                });
            }
        }

        await prisma.Notification.create({
            data: {
                repairJobId: Number(repair_job_id),
                notificationType: "CHAT",
                message: `New chat message from ${senderRole.toLowerCase()}.`,
                isRead: false,
                createdBy: senderId,
                createdRole: senderRole
            }
        });

        return res
            .status(200)
            .json(new ApiResponse(200, chat, "Chat sent successfully."));

    } catch (error) {
        throw new ApiError(
            400,
            `Error while inserting chat. ${error?.message}`
        );
    }
});

const listChat = asyncHandler(async (req, res) => {
    try {

        const { id } = req.body;

        if (!id) {
            throw new ApiError(400, "Job id is required.");
        }

        // const chat = await prisma.chat.findMany({
        //     where: {
        //         repairJobId: Number(id)
        //     },
        //     orderBy: {
        //         createdDate: "asc"
        //     }
        // });

        const chats = await prisma.chat.findMany({
            where: {
                repairJobId: Number(id)
            },
            orderBy: {
                createdDate: "asc"
            }
        });

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
                .json(new ApiResponse(200, null, "No chat found."));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, chatWithSender, "List of chat messages."));

    } catch (error) {
        return res
            .status(400)
            .json(
                new ApiError(
                    400,
                    `Error while fetching chats. ${error?.message}`
                )
            );
    }
});

const toggleRead = asyncHandler(async (req, res) => {
    try {

        const { id } = req.body;

        if (!id) {
            throw new ApiError(400, "Job id is required.");
        }

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
                        null,
                        "All messages are already read."
                    )
                );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    readData,
                    `${readData.count} messages marked as read.`
                )
            );

    } catch (error) {
        return res
            .status(400)
            .json(
                new ApiError(
                    400,
                    `Error while updating read status. ${error?.message}`
                )
            );
    }
});

const unreadCount = asyncHandler(async (req, res) => {
    try {

        const { repair_job_id } = req.body;

        if (!repair_job_id) {
            return res
                .status(400)
                .json(
                    new ApiError(
                        400,
                        "Repair job id is required."
                    )
                );
        }

        const countUnread = await prisma.chat.count({
            where: {
                repairJobId: Number(repair_job_id),
                isRead: false
            }
        });

        if (countUnread === 0) {
            return res
                .status(200)
                .json(
                    new ApiResponse(
                        200,
                        0,
                        "No unread messages."
                    )
                );
        }

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    countUnread,
                    `${countUnread} unread message(s).`
                )
            );

    } catch (error) {
        return res
            .status(400)
            .json(
                new ApiError(
                    400,
                    `Couldn't get unread count. ${error?.message}`
                )
            );
    }
});

export{
    insertChat,
    listChat,
    toggleRead,
    unreadCount
}
