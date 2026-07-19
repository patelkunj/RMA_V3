import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    deactivateDocument,
    getDocumentForAccess,
    listDocuments,
    resolveDocumentDownload,
} from "../services/document.service.js";

const list = asyncHandler(async (req, res) => {
    const documents = await listDocuments(req, { ...req.query, ...req.body });
    return res.status(200).json(new ApiResponse(
        200,
        req.isDeprecatedRoute ? documents.documents : documents,
        "Documents fetched successfully.",
    ));
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
    const { document, buffer, contentType } = await resolveDocumentDownload(req, req.params.id || req.body.id);
    res.setHeader("Content-Type", contentType || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(document.documentName)}`);
    return res.status(200).send(buffer);
});

export {
    deactivate,
    detail,
    download,
    list,
};
