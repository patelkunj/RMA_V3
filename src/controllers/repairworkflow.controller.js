import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
    addWorkLog, assignRepairJob, createEstimate, decideEstimate, getRepairWorkflow,
    listRmaRequests, reviewRmaRequest, submitRmaRequest, transitionRepairJob,
} from "../services/repairworkflow.service.js";

const submitRequest = asyncHandler(async (req, res) => {
    const result = await submitRmaRequest(req, req.body, req.files || []);
    return res.status(201).json(new ApiResponse(201, result, "RMA request submitted successfully."));
});
const listRequests = asyncHandler(async (req, res) => {
    const result = await listRmaRequests(req, { ...req.query, ...req.body });
    return res.status(200).json(new ApiResponse(200, result, "RMA requests fetched successfully."));
});
const reviewRequest = asyncHandler(async (req, res) => {
    const result = await reviewRmaRequest(req, req.params.id, req.body.decision, req.body.note);
    return res.status(200).json(new ApiResponse(200, result, "RMA request reviewed successfully."));
});
const transition = asyncHandler(async (req, res) => {
    const result = await transitionRepairJob(req, req.params.id || req.body.id, req.body.status, req.body.note);
    return res.status(200).json(new ApiResponse(200, result, "Repair job status updated successfully."));
});
const assign = asyncHandler(async (req, res) => {
    const result = await assignRepairJob(req, req.params.id, req.body.technicianId, req.body.priority);
    return res.status(200).json(new ApiResponse(200, result, "Repair job assigned successfully."));
});
const workLogCreate = asyncHandler(async (req, res) => {
    const result = await addWorkLog(req, req.params.id, req.body);
    return res.status(201).json(new ApiResponse(201, result, "Work log created successfully."));
});
const workflowDetail = asyncHandler(async (req, res) => {
    const result = await getRepairWorkflow(req, req.params.id);
    return res.status(200).json(new ApiResponse(200, result, "Repair workflow fetched successfully."));
});
const estimateCreate = asyncHandler(async (req, res) => {
    const result = await createEstimate(req, req.params.id, req.body);
    return res.status(201).json(new ApiResponse(201, result, "Estimate created successfully."));
});
const estimateDecision = asyncHandler(async (req, res) => {
    const result = await decideEstimate(req, req.params.estimateId, req.body.decision, req.body.note);
    return res.status(200).json(new ApiResponse(200, result, "Estimate decision recorded successfully."));
});

export { assign, estimateCreate, estimateDecision, listRequests, reviewRequest, submitRequest, transition, workflowDetail, workLogCreate };
