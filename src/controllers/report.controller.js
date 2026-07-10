import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    getBacklogReportData,
    getCostReportData,
    getCustomerReportData,
    getProductReportData,
    getSummaryReportData,
    getThroughputReportData,
} from "../services/report.service.js";

const sourceFromRequest = (req) => ({
    ...(req.query || {}),
    ...(req.body || {}),
});

const getSummaryReport = asyncHandler(async (req, res) => {
    const report = await getSummaryReportData(req, sourceFromRequest(req));
    return res.status(200).json(new ApiResponse(200, report, "Business summary report."));
});

const getBacklogReport = asyncHandler(async (req, res) => {
    const report = await getBacklogReportData(req, sourceFromRequest(req));
    return res.status(200).json(new ApiResponse(200, report, "Open repair backlog report."));
});

const getThroughputReport = asyncHandler(async (req, res) => {
    const report = await getThroughputReportData(req, sourceFromRequest(req));
    return res.status(200).json(new ApiResponse(200, report, "Repair throughput report."));
});

const getCostReport = asyncHandler(async (req, res) => {
    const report = await getCostReportData(req, sourceFromRequest(req));
    return res.status(200).json(new ApiResponse(200, report, "Repair costing report."));
});

const getProductReport = asyncHandler(async (req, res) => {
    const report = await getProductReportData(req, sourceFromRequest(req));
    return res.status(200).json(new ApiResponse(200, report, "Product failure report."));
});

const getCustomerReport = asyncHandler(async (req, res) => {
    const report = await getCustomerReportData(req, sourceFromRequest(req));
    return res.status(200).json(new ApiResponse(200, report, "Customer performance report."));
});

export {
    getBacklogReport,
    getCostReport,
    getCustomerReport,
    getProductReport,
    getSummaryReport,
    getThroughputReport,
};
