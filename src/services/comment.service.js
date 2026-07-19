import prisma from "../db/prisma.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { removeStoredFiles, storeUploadedFiles } from "../utils/fileUpload.js";
import { generateRandomString } from "../utils/common.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import { respondWithSafeError } from "../utils/safeError.js";
import { paginatedData } from "../utils/pagination.js";

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
    let uploadFiles = [];
    try {

        const repairJobId = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id;
        const { message } = req.body;

        if (!repairJobId) {
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

        await ensureRepairJobAccess(req, repairJobId);

        if (req.files?.length > 0) {
            uploadFiles = await storeUploadedFiles(req.files, repairJobId, "comment");
        }

        const comment = await prisma.$transaction(async (tx) => {
            const createdComment = await tx.repairJobComment.create({
                data: {
                    repairJobId: Number(repairJobId),
                    userId: req.user.id,
                    comment: message.trim()
                }
            });

            if (uploadFiles.length > 0) {
                for (const file of uploadFiles) {
                    await tx.document.create({
                        data: {
                            repairJobId: Number(repairJobId),
                            relatedType: "repair_comment",
                            relatedId: createdComment.id,
                            documentName: file.name,
                            documentUrl: file.reference,
                            documentType: getDocumentType(file.name),
                            uploadedBy: req.user.id,
                            uploadedRole: req.user.role,
                            fileHash: file.hash
                        }
                    });
                }
            }

            return createdComment;
        });

        return res
            .status(201)
            .json(
                new ApiResponse(
                    201,
                    comment,
                    "Comment sent successfully."
                )
            );

    } catch (error) {
        await removeStoredFiles(uploadFiles);
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "comment.insert", "Unable to insert comment.");
    }
});


const listComment = asyncHandler(async (req, res) => {
    try {

        const id = req.params.repairJobId || req.body.repairJobId || req.body.repair_job_id || req.body.id;
        const page = Math.max(Number(req.query.page || req.body.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit || req.body.limit) || 100, 1), 100);

        if (!id) {
            return res
                .status(400)
                .json(new ApiError(400, "Job id is required."));
        }

        await ensureRepairJobAccess(req, id);

        const where = { repairJobId: Number(id) };
        const [comments, total] = await Promise.all([
            prisma.repairJobComment.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true
                        }
                    }
                },
                orderBy: { createdDate: "asc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.repairJobComment.count({ where }),
        ]);

        const documents = await prisma.document.findMany({
            where: {
                repairJobId: Number(id),
                relatedType: "repair_comment"
            },
            take: limit * 10,
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
                req.isDeprecatedRoute
                    ? commentsWithDocuments
                    : paginatedData(commentsWithDocuments, { total, page, limit }, "comments"),
                "Comments fetched successfully."
            )
        );

    } catch (error) {
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "comment.list", "Unable to list comments.");
    }
});

const updateComment = asyncHandler(async (req, res) => {
    try {

        const id = req.params.id || req.body.id;
        const { message } = req.body;

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


        await ensureRepairJobAccess(req, existingComment.repairJobId);

        if (req.user.role === "TECHNICIAN" && existingComment.userId !== req.user.id) {
            return res.status(403).json(new ApiError(403, "You can only edit your own comments."));
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
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "comment.update", "Unable to update comment.");
    }
});

export{
    insertComment,
    listComment,
    updateComment
}
