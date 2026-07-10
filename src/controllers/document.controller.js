import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    deactivateDocument,
    getDocumentForAccess,
    listDocuments,
    resolveDocumentPath,
} from "../services/document.service.js";

const list = asyncHandler(async (req, res) => {
    const documents = await listDocuments(req, { ...req.query, ...req.body });
    return res.status(200).json(new ApiResponse(200, documents, "Documents fetched successfully."));
});

const detail = asyncHandler(async (req, res) => {
    const document = await getDocumentForAccess(req, req.params.id || req.body.id);
    return res.status(200).json(new ApiResponse(200, document, "Document fetched successfully."));
});

const deactivate = asyncHandler(async (req, res) => {
    const document = await deactivateDocument(req, req.params.id || req.body.id);
    return res.status(200).json(new ApiResponse(200, document, "Document deactivated successfully."));
});

const download = asyncHandler(async (req, res) => {
    const { document, filePath } = await resolveDocumentPath(req, req.params.id || req.body.id);
    return res.download(filePath, document.documentName);
});

export {
    deactivate,
    detail,
    download,
    list,
};
