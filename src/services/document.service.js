import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ApiError } from "../utils/ApiError.js";
import { ensureRepairJobAccess } from "../utils/accessControl.js";
import prisma from "../db/prisma.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, "../../public");

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

    return prisma.document.findMany({
        where: {
            repairJobId: Number(repairJobId),
            ...(filters.relatedType ? { relatedType: String(filters.relatedType) } : {}),
            ...(filters.isActive === undefined ? {} : { isActive: filters.isActive === true || filters.isActive === "true" }),
        },
        orderBy: { uploadedDate: "desc" },
        select: documentSelect,
    });
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

const resolveDocumentPath = async (req, documentId) => {
    const document = await getDocumentForAccess(req, documentId);
    const relativePath = document.documentUrl.replace(/^\/+/, "");
    const filePath = path.resolve(publicDir, relativePath.replace(/^public\/?/, ""));

    if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
        throw new ApiError(404, "Document file not found.");
    }

    return { document, filePath };
};

export {
    deactivateDocument,
    getDocumentForAccess,
    listDocuments,
    resolveDocumentPath,
};
