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

const insertComment = asyncHandler(async (req, res) => {
    try {

        const { repair_job_id, message } = req.body;

        if (!repair_job_id) {
            return res
                .status(400)
                .json(new ApiError(400, "Job id is required."));
        }

        if (!req.user) {
            return res
                .status(403)
                .json(new ApiError(403, "Only internal users can add repair job comments."));
        }

        if (!message?.trim()) {
            return res
                .status(400)
                .json(new ApiError(400, "Comment message is required."));
        }

        const repairJob = await prisma.repairJob.findUnique({
            where: { id: Number(repair_job_id) },
            select: { id: true },
        });

        if (!repairJob) {
            return res
                .status(404)
                .json(new ApiError(404, "Repair job not found."));
        }

        const comment = await prisma.$transaction(async (tx) => {
            const createdComment = await tx.repairJobComment.create({
                data: {
                    repairJobId: Number(repair_job_id),
                    userId: req.user.id,
                    comment: message.trim()
                }
            });

            if (req.files?.length > 0) {
                const uploadFiles = await moveUploadedFiles(
                    req.files,
                    repair_job_id,
                    "comment"
                );

                for (const file of uploadFiles) {
                    await tx.document.create({
                        data: {
                            repairJobId: Number(repair_job_id),
                            relatedType: "repair_comment",
                            relatedId: createdComment.id,
                            documentName: file,
                            documentUrl: `/uploads/${repair_job_id}/comment/${file}`,
                            documentType: getDocumentType(file),
                            uploadedBy: req.user.id,
                            uploadedRole: req.user.role,
                            fileHash: generateRandomString(15)
                        }
                    });
                }
            }

            return createdComment;
        });

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    comment,
                    "Comment sent successfully."
                )
            );

    } catch (error) {

        return res.status(400).json(
            new ApiError(
                400,
                `Error while inserting comment. ${error?.message}`
            )
        );
    }
});


const listComment = asyncHandler(async (req, res) => {
    try {

        const { id } = req.body;

        if (!id) {
            return res
                .status(400)
                .json(new ApiError(400, "Job id is required."));
        }

        const comments = await prisma.repairJobComment.findMany({
            where: {
                repairJobId: Number(id)
            },
            include: {
                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true
                    }
                }
            },
            orderBy: {
                createdDate: "asc"
            }
        });

        const documents = await prisma.document.findMany({
            where: {
                repairJobId: Number(id),
                relatedType: "repair_comment"
            }
        });

        const documentMap = documents.reduce((acc, document) => {

            if (!acc[document.relatedId]) {
                acc[document.relatedId] = [];
            }

            acc[document.relatedId].push({
                id: document.id,
                documentName: document.documentName,
                documentUrl: document.documentUrl,
                documentType: document.documentType
            });

            return acc;

        }, {});

        const commentsWithDocuments = comments.map(comment => ({
            ...comment,
            documents: documentMap[comment.id] || []
        }));

        return res.status(200).json(
            new ApiResponse(
                200,
                commentsWithDocuments,
                "List of comments."
            )
        );

    } catch (error) {

        return res.status(400).json(
            new ApiError(
                400,
                `Error while listing comments. ${error?.message}`
            )
        );
    }
});

const updateComment = asyncHandler(async (req, res) => {
    try {

        const { id, message } = req.body;

        if (!id || !message?.trim()) {
            return res.status(400).json(
                new ApiError(
                    400,
                    "All fields are required."
                )
            );
        }

        if (!req.user) {
            return res.status(403).json(
                new ApiError(
                    403,
                    "Only internal users can update repair job comments."
                )
            );
        }

        const existingComment =
            await prisma.repairJobComment.findUnique({
                where: {
                    id: Number(id)
                }
            });

        if (!existingComment) {
            return res.status(404).json(
                new ApiError(
                    404,
                    "Comment not found."
                )
            );
        }

        const comment =
            await prisma.repairJobComment.update({
                where: {
                    id: Number(id)
                },
                data: {
                    comment: message.trim(),
                    isEdited: true
                }
            });

        return res.status(200).json(
            new ApiResponse(
                200,
                comment,
                "Comment updated successfully."
            )
        );

    } catch (error) {

        return res.status(400).json(
            new ApiError(
                400,
                `Error while updating comment. ${error?.message}`
            )
        );
    }
});

export{
    insertComment,
    listComment,
    updateComment
}
