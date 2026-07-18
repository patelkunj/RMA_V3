import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    createOrganization,
    getOrganization,
    getOrganizationLogo,
    listOrganizations,
    removeOrganizationLogo,
    toggleOrganizationStatus,
    updateOrganizationRecord,
    uploadOrganizationLogo,
} from "../services/organization.service.js";

const listOrganization = asyncHandler(async (req, res) => {
    const result = await listOrganizations(req, req.query);
    return res.status(200).json(new ApiResponse(200, result, "List of all organizations"));
});

const creatOrganization = asyncHandler(async (req, res) => {
    const organization = await createOrganization(req, req.body);
    return res.status(201).json(new ApiResponse(201, organization, "Organization created successfully"));
});

const updateOrganization = asyncHandler(async (req, res) => {
    const organization = await updateOrganizationRecord(req, req.body);
    return res.status(200).json(new ApiResponse(200, organization, "Organization updated successfully"));
});

const toggleStatus = asyncHandler(async (req, res) => {
    const organization = await toggleOrganizationStatus(req, req.body.id);
    return res.status(200).json(new ApiResponse(200, organization, "Status updated successfully"));
});

const getOrganizationDetail = asyncHandler(async (req, res) => {
    const organization = await getOrganization(req, req.params.id);
    return res.status(200).json(new ApiResponse(200, organization, "Organization data found."));
});

const uploadLogo = asyncHandler(async (req, res) => {
    const organization = await uploadOrganizationLogo(req, req.params.id, req.file);
    return res.status(200).json(new ApiResponse(200, organization, "Organization logo updated successfully."));
});

const downloadLogo = asyncHandler(async (req, res) => {
    const logo = await getOrganizationLogo(req, req.params.id);
    if (req.headers["if-none-match"] === logo.etag) return res.status(304).end();
    res.setHeader("Content-Type", logo.mimeType);
    res.setHeader("Content-Length", logo.size);
    res.setHeader("Cache-Control", "private, max-age=3600, must-revalidate");
    res.setHeader("ETag", logo.etag);
    if (logo.updatedAt) res.setHeader("Last-Modified", new Date(logo.updatedAt).toUTCString());
    return res.status(200).send(logo.buffer);
});

const deleteLogo = asyncHandler(async (req, res) => {
    const organization = await removeOrganizationLogo(req, req.params.id);
    return res.status(200).json(new ApiResponse(200, organization, "Organization logo removed successfully."));
});

export {
    creatOrganization,
    deleteLogo,
    downloadLogo,
    getOrganizationDetail,
    listOrganization,
    toggleStatus,
    updateOrganization,
    uploadLogo,
};
