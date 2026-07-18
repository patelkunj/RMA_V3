import prisma from "../db/prisma.js";
import { createChatNotifications } from "./notification.service.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { removeStoredFiles, storeUploadedFiles } from "../utils/fileUpload.js";

const getDocumentType = (fileName) => {
    const extension = fileName.toLowerCase();

    if ([".jpg", ".jpeg", ".png", ".webp"].some((suffix) => extension.endsWith(suffix))) {
        return "IMAGE";
    }

    if (extension.endsWith(".pdf")) return "PDF";
    if (extension.endsWith(".doc") || extension.endsWith(".docx")) return "DOC";

    return "OTHER";
};

const sendChatMessage = async (req, { repairJobId, message, files = [] }) => {
    const jobId = Number(repairJobId);
    await ensureRepairJobAccess(req, jobId);

    const senderId = req.user?.id || req.customer?.id;
    const senderType = req.user ? "USER" : "CUSTOMER";
    const senderRole = req.user?.role || req.customer?.role;
    const normalizedMessage = String(message ?? "").trim();
    const uploadedFiles = files.length
        ? await storeUploadedFiles(files, jobId, "chat")
        : [];

    try {
        return await prisma.$transaction(async (transaction) => {
        const repairJob = await transaction.repairJob.findUnique({
            where: { id: jobId },
            select: {
                id: true,
                organizationId: true,
                customerId: true,
                createdBy: true,
                receivedBy: true,
            },
        });

        const chat = await transaction.chat.create({
            data: {
                repairJobId: jobId,
                senderId,
                senderRole: senderType,
                message: normalizedMessage,
            },
        });

        if (uploadedFiles.length) {
            await transaction.document.createMany({
                data: uploadedFiles.map((file) => ({
                    repairJobId: jobId,
                    relatedType: "chat",
                    relatedId: chat.id,
                    documentName: file.name,
                    documentUrl: file.reference,
                    documentType: getDocumentType(file.name),
                    uploadedBy: senderId,
                    uploadedRole: senderRole,
                    fileHash: file.hash,
                })),
            });
        }

        await createChatNotifications(transaction, {
            repairJob,
            chatId: chat.id,
            senderType,
            senderRole,
        });

        return chat;
        });
    } catch (error) {
        await removeStoredFiles(uploadedFiles);
        throw error;
    }
};

export { sendChatMessage };
