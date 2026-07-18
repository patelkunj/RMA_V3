import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { createInvoice, getInvoice, recordPayment, voidInvoice } from "../services/billing.service.js";

const create = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await createInvoice(req, req.params.repairJobId, req.body), "Invoice created successfully.")));
const detail = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await getInvoice(req, req.params.id), "Invoice fetched successfully.")));
const pay = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(201, await recordPayment(req, req.params.id, req.body), "Payment recorded successfully.")));
const voidRecord = asyncHandler(async (req, res) => res.status(200).json(new ApiResponse(200, await voidInvoice(req, req.params.id, req.body.reason), "Invoice voided successfully.")));
export { create, detail, pay, voidRecord };
