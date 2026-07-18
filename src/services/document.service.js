import fs from "fs";
import path from "path";
import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import prisma from "../db/prisma.js";
import { getPrivateObject, keyFromReference } from "./objectStorage.service.js";
import { paginatedData } from "../utils/pagination.js";

const publicDir = path.resolve("public");

const documentSelect = {
    id: true,
    repairJobId: true,
    relatedType: true,
    relatedId: true,
    documentName: true,
    documentUrl: true,
    documentType: true,
    uploadedBy: true,
    uploadedRole: true,
    isActive: true,
    uploadedDate: true,
    updatedDate: true,
};

const listDocuments = async (req, filters = {}) => {
    const repairJobId = filters.repairJobId || filters.repair_job_id;
    if (!repairJobId) {
        throw new ApiError(400, "repairJobId is required.");
    }

    await ensureRepairJobAccess(req, repairJobId);
    const page = Math.max(Number(filters.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filters.limit) || 50, 1), 100);
    const where = {
        repairJobId: Number(repairJobId),
        ...(filters.relatedType ? { relatedType: String(filters.relatedType) } : {}),
        ...(filters.isActive === undefined ? {} : { isActive: filters.isActive === true || filters.isActive === "true" }),
    };
    const [documents, total] = await Promise.all([
        prisma.document.findMany({
            where,
            orderBy: { uploadedDate: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: documentSelect,
        }),
        prisma.document.count({ where }),
    ]);
    return paginatedData(documents, { total, page, limit }, "documents");
};

const getDocumentForAccess = async (req, documentId) => {
    if (!documentId) {
        throw new ApiError(400, "document id is required.");
    }

    const document = await prisma.document.findUnique({
        where: { id: Number(documentId) },
        select: documentSelect,
    });

    if (!document || !document.isActive) {
        throw new ApiError(404, "Document not found.");
    }

    await ensureRepairJobAccess(req, document.repairJobId);
    return document;
};

const deactivateDocument = async (req, documentId) => {
    const document = await getDocumentForAccess(req, documentId);

    return prisma.document.update({
        where: { id: document.id },
        data: { isActive: false },
        select: documentSelect,
    });
};

const resolveDocumentDownload = async (req, documentId) => {
    const document = await getDocumentForAccess(req, documentId);
    const objectKey = keyFromReference(document.documentUrl);
    if (objectKey) {
        const stored = await getPrivateObject(objectKey);
        if (document.fileHash && stored.hash !== document.fileHash) throw new ApiError(409, "Document failed its integrity check.");
        return { document, buffer: stored.buffer, contentType: stored.contentType };
    }

    // Backward-compatible read path for files created before object storage was enabled.
    const relativePath = document.documentUrl.replace(/^\/+/, "");
    const filePath = path.resolve(publicDir, relativePath.replace(/^public\/?/, ""));

    const relativeToPublic = path.relative(publicDir, filePath);
    if (relativeToPublic.startsWith("..") || path.isAbsolute(relativeToPublic) || !fs.existsSync(filePath)) {
        throw new ApiError(404, "Document file not found.");
    }

    const buffer = await fs.promises.readFile(filePath);
    return { document, buffer, contentType: "application/octet-stream" };
};

export {
    deactivateDocument,
    getDocumentForAccess,
    listDocuments,
    resolveDocumentDownload,
};
