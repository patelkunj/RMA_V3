import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import moment from "moment"
import { overduedays, generateRandomString } from "../utils/common.js"
import { removeStoredFiles, storeUploadedFiles } from "../utils/fileUpload.js"
import {
    ensureRepairJobAccess,
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    getRepairJobAccessWhere,
    isSuperAdmin,
} from "../utils/accessControl.js";
import { logger } from "../utils/logger.js";
import { sendRepairJobStatusEmailSafely } from "../services/email.service.js";
import { submitRmaRequest, transitionRepairJob } from "../services/repairworkflow.service.js";
import { encryptDeviceCredential } from "../utils/encryption.js";
import prisma from "../db/prisma.js"
import { respondWithSafeError, safeServiceError } from "../utils/safeError.js";
import { paginatedData } from "../utils/pagination.js";


const JOB_STATUSES = new Set(["CREATED", "RECEIVED", "IN_PROGRESS", "WAITING_PARTS", "COMPLETED", "CANCELLED"]);
const firstDefined = (payload, camelCaseKey, legacyKey) => payload?.[camelCaseKey] ?? payload?.[legacyKey];
const asBoolean = (value) => value === true || value === "true";
const normalizeRepairJobInput = (payload = {}) => ({
    organizationId: firstDefined(payload, "organizationId", "organization_id"),
    customerId: firstDefined(payload, "customerId", "customer_id") ?? payload.Customer_id,
    storeCode: firstDefined(payload, "storeCode", "store_code"),
    companyJobNo: firstDefined(payload, "companyJobNo", "company_job_no"),
    salesInvoice: firstDefined(payload, "salesInvoice", "sales_invoice"),
    sku: payload.sku,
    productName: firstDefined(payload, "productName", "product_name"),
    serialNumber: firstDefined(payload, "serialNumber", "serial_number"),
    devicePassword: firstDefined(payload, "devicePassword", "device_password"),
    isDoa: firstDefined(payload, "isDoa", "is_doa"),
    isProductUnderWarranty: firstDefined(payload, "isProductUnderWarranty", "is_product_under_warranty")
        ?? payload.is_product_under_waranty,
    cloudStatus: firstDefined(payload, "cloudStatus", "cloud_status"),
    cloudDetails: firstDefined(payload, "cloudDetails", "cloud_details"),
    productFault: firstDefined(payload, "productFault", "product_fault"),
    videoUrl: firstDefined(payload, "videoUrl", "video_url"),
    customerTrackingNumber: firstDefined(payload, "customerTrackingNumber", "customer_tracking_number"),
    jobStatus: firstDefined(payload, "jobStatus", "job_status"),
});

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

// for admin,
const listRepairJob = asyncHandler(async (req, res) => {
    try{
        const input = { ...req.body, ...req.query };
        const status = String(input.status || input.field || "created").toUpperCase()
        // NOTE: uppercased to match the JobStatus enum (CREATED, RECEIVED, IN_PROGRESS, WAITING_PARTS, COMPLETED, CANCELLED)

        if (!JOB_STATUSES.has(status)) {
            return res.status(400).json(new ApiError(400, "Invalid repair job status."));
        }

        const page = Math.max(Number(input.page) || 1, 1);
        const limit = Math.min(Math.max(Number(input.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const where = {
            ...(await getRepairJobAccessWhere(req)),
            jobStatus: status,
        };

        const [repairjob, total] = await Promise.all([
            prisma.repairJob.findMany({
                where,
                skip,
                take: limit,
                orderBy: { id: "desc" },
            }),
            prisma.repairJob.count({ where }),
        ]);


        // NOTE: findMany() always returns an array. The original
        // `typeof repairjob === "object"` branch was actually unreachable for
        // arrays too (typeof [] === "object" in JS), so the array-mapping
        // logic below is now the only path — collapsed accordingly.
        const modifiedData = repairjob.map(({ devicePassword, ...job }) =>({
            ...job,
            overDueDays: overduedays(job.receivedDate),
            receivedDate: moment(job.receivedDate).format('DD-MM-YYYY'),
            createdDate: moment(job.createdDate).format('DD-MM-YYYY HH:mm:ss'),
            updatedDate: moment(job.updatedDate).format('DD-MM-YYYY HH:mm:ss'),
        }))

        return res.status(200).json(new ApiResponse(
            200,
            paginatedData(modifiedData, { total, page, limit }, "repairJobs"),
            "Repair jobs fetched successfully.",
        ))

    }catch(error){
        throw safeServiceError(error, "repair-job.list", "Unable to list repair jobs.");
    }
})


const insertRepairJob = asyncHandler(async (req, res) => {
    try {
        if (req.customer) {
            const request = await submitRmaRequest(req, req.body, req.files || []);
            return res.status(201).json(new ApiResponse(201, request, "RMA request submitted successfully."));
        }
        // Extract data from request body
        const {
            organizationId,
            customerId,
            storeCode,
            companyJobNo,
            salesInvoice,
            sku,
            productName,
            serialNumber,
            devicePassword,
            isDoa,
            isProductUnderWarranty,
            cloudStatus,
            cloudDetails,
            productFault,
            videoUrl,
            customerTrackingNumber,
        } = normalizeRepairJobInput(req.body);

        // Validation of data
        if ([organizationId, customerId, storeCode, salesInvoice, sku, productName, serialNumber, productFault, customerTrackingNumber]
            .some((field) => String(field ?? "").trim() === "")) {
            return res.status(400).json(new ApiError(400, " Please fill the required field information"))
        }

        if (!req.user) {
            return res.status(403).json(new ApiError(403, "Only internal users can create repair jobs from this endpoint."));
        }

        await ensureUserCanAccessOrganization(req.user, organizationId);

        const customer = await prisma.customer.findFirst({
            where: { id: Number(customerId), organizationId: Number(organizationId) },
            select: { id: true },
        });
        if (!customer) throw new ApiError(400, "Customer does not belong to the selected organization.");
        const job_id = await allocateRepairJobNumber(Number(organizationId), storeCode);
        const settings = await prisma.organizationSetting.findUnique({ where: { organizationId: Number(organizationId) } });
        const slaDueAt = new Date(Date.now() + Number(settings?.defaultSlaHours || 120) * 3600000);

        // Check if the job already exists
        // NOTE: "Dispatch" mapped to COMPLETED (see conversion notes #4)
        const existingJob = await prisma.repairJob.findFirst({
            where: {
                serialNumber,
                jobStatus: { not: "COMPLETED" },
            },
        });
        if (existingJob) {
            return res.status(409).json(new ApiError(409, "Repair job already exists."))
        }

        // Insert job into the database
        const createdRepairJob = await prisma.repairJob.create({
            data: {
                raJobId: job_id,
                organizationId: Number(organizationId),
                customerId: Number(customerId),
                customerJobNo: (companyJobNo === 'undefine') ? null : companyJobNo,
                salesInvoice: (salesInvoice === 'undefine') ? null : salesInvoice,
                sku,
                productName,
                serialNumber: (serialNumber === 'undefine') ? null : serialNumber,
                devicePassword: (!devicePassword || devicePassword === 'undefine') ? null : encryptDeviceCredential(devicePassword),
                isDoa: asBoolean(isDoa),
                isProductUnderWarranty: asBoolean(isProductUnderWarranty),
                cloudStatus: cloudStatus ?? null,
                cloudDetails: (cloudDetails === 'undefine') ? null : cloudDetails,
                productFault: (productFault === 'undefine') ? null : productFault,
                videoUrl: (videoUrl === 'undefine') ? null : videoUrl,
                customerTrackingNumber: (customerTrackingNumber === 'undefine') ? null : customerTrackingNumber,
                createdBy: Number(req.user.id),
                createdRoleBy: req.user.role,
                slaDueAt,
                // createdDate / updatedDate intentionally omitted — handled by @default(now()) / @updatedAt
            },
        });

        await prisma.repairJobTracking.create({
            data: {
                repairJobId: createdRepairJob.id,
                status: createdRepairJob.jobStatus,
                changedBy: Number(req.user.id),
            },
        });

        const uploadfiles = await storeUploadedFiles(req.files, createdRepairJob.id,"repair_job")

        let documents = []
        try {
            for(let j=0; j< uploadfiles.length; j++){
                documents[j] = await prisma.document.create({
                    data: {
                        repairJobId: createdRepairJob.id,
                        relatedType: "repair_job",
                        relatedId: createdRepairJob.id,
                        documentName: uploadfiles[j].name,
                        documentUrl: uploadfiles[j].reference,
                        documentType: getDocumentType(uploadfiles[j].name),
                        uploadedBy: req.user?.id || req.customer?.id,
                        uploadedRole: req.user?.role || req.customer?.role || "CUSTOMER",
                        fileHash: uploadfiles[j].hash,
                    },
                })
            }
        } catch (error) {
            await removeStoredFiles(uploadfiles);
            throw error;
        }

        //Log creation
        const log = {
            actorId: req.user.id ,
            actorRole: req.user.role,
            description: `${req.user.firstName} ${req.user.lastName} created the RA Job ${job_id}`,
            logStatus: "Successful", // Assume success by default
        };

        // NOTE: createdRepairJob is always truthy here — Prisma's create() either
        // returns the row or throws (caught below). The old "did the create fail"
        // check is effectively dead code now, left in place for structural parity.
        if (!createdRepairJob) {
            log.logStatus = "Failure";
            await prisma.systemLog.create({ data: log });
            return res.status(400).json(new ApiError(400, " Something went wrong while adding the repair job."))
        }

        // Attempt to send email
        try {

            await sendRepairJobStatusEmailSafely(createdRepairJob.id);

        } catch (emailError) {
            logger.error("Email sending failed:", emailError);
            log.description += ` (Email sending failed: ${emailError.message})`;
            log.logStatus = "Warning";
        }

        // Log the result of the process
        await prisma.systemLog.create({ data: log });

        return res.status(201).json(new ApiResponse(201, createdRepairJob, `RA Job ${job_id} created successfully.`));

    } catch (error) {
        if (!res.headersSent) throw safeServiceError(error, "repair-job.create", "Unable to create repair job.");
        logger.error("Error occurred after repair job response was sent", { error });
    }
})


const updateRepairJobSKU = asyncHandler(async (req, res) => {
    try {
        const id = req.params.id || req.body?.id;
        const { sku } = req.body;

        // Validation of data
        if ([id, sku].some((field) => String(field ?? "").trim() === "")) {
            return res.status(400).json(new ApiError(400, "All fields are required"));
        }

        const existingRepairJob = await ensureRepairJobAccess(req, id);

        const product = await prisma.product.findFirst({
            where: {
                sku,
                organizationId: existingRepairJob.organizationId,
            },
        });
        if(!product){
            return res.status(404).json(new ApiError(404, "Product SKU not found."));
        }

        let product_name = product.name
        product_name += (product.model)? "- "+product.model : ""
        product_name += (product.color) ? "- "+product.color :""

        const newSKU = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: { sku, productName: product_name },
            // updatedDate intentionally omitted — handled by @updatedAt
        });
        if(!newSKU){
           // NOTE: update() throws (P2025) rather than returning falsy if not found — see conversion notes #7
           return res.status(400).json(new ApiError(400," Error while updating the SKU in repair job."))
        }

        //Log creation
        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(id),
                actionType: "UPDATE",
                description: `Updated  SKU to ${sku}`,
                performedBy: req.user?.id,
                // performedAt intentionally omitted — handled by @default(now())
            },
        });

        return res.status(200).json(new ApiResponse(200, newSKU, "Repair job SKU updated successfully."))

    } catch (error) {
         return respondWithSafeError(res, error, "repair-job.update-sku", "Unable to update repair job.");
    }
})

const updateRepairJobSerialNumber = asyncHandler(async (req, res) => {
    try {
        const id = req.params.id || req.body?.id;
        const serialNumber = req.body.serialNumber ?? req.body.serial_number;
        // Validation of data
        if ([id, serialNumber].some((field) => String(field ?? "").trim() === "")) {
             return res.status(400).json(new ApiError(400, "All fields are required"));
        }

        const existingRepairJob = await ensureRepairJobAccess(req, id);

        const productSerial = await prisma.productSerial.findUnique({
            where: { serialNumber },
            include: { product: true },
        });

        if(!productSerial || !productSerial.product || productSerial.organizationId !== existingRepairJob.organizationId){
            return res.status(404).json(new ApiError(404, "Serial number not found."))
        }

        const log = {
            repairJobId: Number(id),
            actionType: "UPDATE",
            description: `Updated serial number to ${productSerial.serialNumber}`,
            performedBy: req.user?.id,
        };

        const data = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: {
                sku: productSerial.product.sku,
                productName: productSerial.product.name,
                serialNumber: productSerial.serialNumber,
                salesInvoice: productSerial.salesInvoice,
            },
        });
        if(!data){
            return res.status(400).json(new ApiError(400, " Error while updating the serial number"))
        }

        // log creation
        await prisma.repairJobAuditLog.create({ data: log });
        return res.status(200).json(new ApiResponse(200, data, "Repair job serial number updated successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.update-serial-number", "Unable to update repair job serial number.");
    }
})


const serialNumberLookup = asyncHandler(async (req, res) => {
    try {
        const serialNumber = req.body.serialNumber ?? req.body.serial_number;
        // Validation of data
        if (String(serialNumber ?? "").trim() === "") {
            return res.status(400).json(new ApiError(400, "serial number is required"));
        }

        const productSerial = await prisma.productSerial.findUnique({
            where: { serialNumber },
            include: { product: true },
        });

        if(!productSerial){
           return res.status(404).json(new ApiError(404, "Serial number not found."))
        }

        const hasAccessToSerial = req.customer
            ? req.customer.organizationId === productSerial.organizationId
            : isSuperAdmin(req.user) || (await getAssignedOrganizationIds(req.user)).includes(productSerial.organizationId);

        if (!hasAccessToSerial) {
            return res.status(403).json(new ApiError(403, "You do not have access to this serial number."));
        }

        return res.status(200).json(new ApiResponse(200, productSerial, "Serial number fetched successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.serial-number-lookup", "Unable to look up serial number.");
    }
})


const updateTrackingNumber = asyncHandler(async (req, res) => {
    try {
        const id = req.params.id || req.body?.id;
        const trackingNumber = req.body.trackingNumber ?? req.body.tracking_number;
        // Validation of data
        if (!id || !trackingNumber) {
            return res.status(400).json( new ApiError(400, " Tracking number is required"));
        }

        await ensureRepairJobAccess(req, id);

        const repairjob = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: { customerTrackingNumber: trackingNumber },
        });
        if(!repairjob){
            return res.status(400).json( new ApiError(400, " Tracking Number isn't updated successfaully."))
        }

        //Log creation
        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(id),
                actionType: "UPDATE",
                description: `Updated tracking number to ${trackingNumber}`,
                performedBy: req.user?.id,
            },
        });

        return res.status(200).json(new ApiResponse(200, repairjob, "Tracking number updated successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.update-tracking-number", "Unable to update tracking number.");
    }
})


const updateStatus = asyncHandler(async (req, res) => {
    const id = req.params.id || req.body?.id;
    const { status, note } = req.body;
    const repairjob = await transitionRepairJob(req, id, status, note);
    return res.status(200).json(new ApiResponse(200, repairjob, "Status updated successfully."));
})


const updateDispatchId = asyncHandler(async (req, res) => {
    try {
        const id = req.params.id || req.body?.id;
        const dispatchId = req.body.dispatchId ?? req.body.dispatch_id;
        // Validation of data
        if ([id, dispatchId].some((field) => String(field ?? "").trim() === "")) {
            return res.status(400).json(new ApiError(400, "All fields are required"));
        }

        await ensureRepairJobAccess(req, id);

        const repairjob = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: {
                dispatchId: dispatchId,
                jobStatus: "COMPLETED", // was "completed" — mapped to enum value
                completionDate: new Date(), // was a moment-formatted string; Prisma DateTime wants a real Date/ISO value
            },
        });
        if(!repairjob){
            return res.status(400).json(new ApiError(400, " Dispatch ID  isn't updated successfaully."));
        }

        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(id),
                actionType: "STATUS_CHANGE",
                description: `Updated  Dispatch ID to ${dispatchId}`,
                performedBy: req.user?.id,
            },
        });
        await prisma.repairJobTracking.create({
            data: {
                repairJobId: Number(id),
                status: "COMPLETED",
                changedBy: Number(req.user?.id),
            },
        });
        await sendRepairJobStatusEmailSafely(repairjob.id);
        return res.status(200).json(new ApiResponse(200, repairjob, "Dispatch ID updated successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.update-dispatch-id", "Unable to update dispatch ID.");
    }
})


const receiveJob = asyncHandler(async (req, res) => {
    try {
        const id = req.params.id || req.body?.id;
        const trackingNumber = req.body.trackingNumber ?? req.body.tracking_number;
        // Validation of data
        if (!id || !trackingNumber) {
            // NOTE: original had no `return` here at all (not just a typo) — added,
            // since otherwise execution falls through to the update() below.
            return res.status(400).json(new ApiError(400, " Tracking number is required"));
        }

        await ensureRepairJobAccess(req, id);

        const repairjob = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: {
                customerTrackingNumber: trackingNumber,
                jobStatus: "RECEIVED",
                receivedBy: Number(req.user?.id),
                receivedRoleBy: req.user?.role,
                receivedDate: new Date(), // was a moment-formatted string
            },
        });

        if(!repairjob){
            // NOTE: same missing-return issue as above — added.
            return res.status(400).json(new ApiError(400, " Job is not received successfaully."));
        }

        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(id),
                actionType: "STATUS_CHANGE",
                description: `Received job with tracking number ${trackingNumber}`,
                performedBy: req.user?.id,
            },
        });
        await prisma.repairJobTracking.create({
            data: {
                repairJobId: Number(id),
                status: "RECEIVED",
                changedBy: Number(req.user?.id),
            },
        });

        await sendRepairJobStatusEmailSafely(repairjob.id);
        const updateJob = await prisma.repairJob.findUnique({ where: { id: Number(id) } });
        return res.status(200).json(new ApiResponse(200, updateJob, "Repair job received successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.receive", "Unable to receive repair job.");
    }
})


const repairJob = asyncHandler(async (req, res) => {
    try {
        const id = req.params.id || req.body?.id;
        if (!id) {
            throw new ApiError(400, "fields is required");
        }
        await ensureRepairJobAccess(req, id);
        const repairjob = await prisma.repairJob.findUnique({ where: { id: Number(id) } });

         if(!repairjob){
            throw new ApiError(404, "Repair job not found.")
        }

        delete repairjob.devicePassword;
        repairjob.overDueDays = overduedays(repairjob.receivedDate)

        return res.status(200).json(new ApiResponse(200, repairjob, "Repair job fetched successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.detail", "Unable to fetch repair job.");
    }
})


const searchRepairJob = asyncHandler(async (req, res) => {
    try {
        const {searchData} = req.body
        // Validation of data
        if (!searchData) {
            throw new ApiError(400, "fields is required");
        }

        // ⚠️ NOTE (see conversion notes #11): the body of the original
        // RepairJob.search() wasn't provided, so this is a best-effort
        // reconstruction — a case-insensitive partial match across the most
        // likely searchable fields. Adjust the field list to match whatever
        // the original search actually covered.
        const repairjob = await prisma.repairJob.findMany({
            where: {
                ...(await getRepairJobAccessWhere(req)),
                OR: [
                    { raJobId: { contains: searchData, mode: 'insensitive' } },
                    { sku: { contains: searchData, mode: 'insensitive' } },
                    { productName: { contains: searchData, mode: 'insensitive' } },
                    { serialNumber: { contains: searchData, mode: 'insensitive' } },
                    { customerTrackingNumber: { contains: searchData, mode: 'insensitive' } },
                    { dispatchId: { contains: searchData, mode: 'insensitive' } },
                    { salesInvoice: { contains: searchData, mode: 'insensitive' } },
                    { customerJobNo: { contains: searchData, mode: 'insensitive' } },
                ],
            },
            take: 100,
        });

        return res.status(200).json(new ApiResponse(200, repairjob, "Repair jobs fetched successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.search", "Unable to search repair jobs.");
    }
})


const insertMultipleRepairJobs = asyncHandler(async (req, res) => {
    try {

        const Jobdata = req.body

        if(!Jobdata){
            throw new ApiError(404,"No data found from body")
        }

        if (!req.user) {
            throw new ApiError(403, "Only internal users can create repair jobs.");
        }

        const jobInput = normalizeRepairJobInput(Jobdata);
        const organizationId = Number(jobInput.organizationId);
        const customerId = Number(jobInput.customerId);

        if (!organizationId || !customerId || !jobInput.storeCode) {
            throw new ApiError(400, "organizationId, customerId, and storeCode are required.");
        }

        await ensureUserCanAccessOrganization(req.user, organizationId);

        const customer = await prisma.customer.findFirst({
            where: {
                id: customerId,
                organizationId,
            },
            select: { id: true },
        });

        if (!customer) {
            throw new ApiError(400, "Customer does not belong to the selected organization.");
        }

        let repairJob, job_id;
        let jobInfo=[];
        const rawItems = Jobdata.items ?? Jobdata.data;
        if (rawItems === undefined || rawItems === null) {
            throw new ApiError(400, "items are required.");
        }
        let entries;
        try {
            entries = (Array.isArray(rawItems) ? rawItems : [rawItems]).flatMap((entry) => {
                const parsed = typeof entry === "string" ? JSON.parse(entry) : entry;
                return Array.isArray(parsed) ? parsed : [parsed];
            });
        } catch {
            throw new ApiError(400, "items must contain valid JSON objects.");
        }
        if (!entries.length) throw new ApiError(400, "items must contain at least one repair job.");

        for(let i=0; i< entries.length; i++){

            job_id = await allocateRepairJobNumber(organizationId, jobInput.storeCode)

            const inputdata = normalizeRepairJobInput(entries[i]);
            if ([inputdata.salesInvoice, inputdata.sku, inputdata.productName, inputdata.serialNumber, inputdata.productFault]
                .some((field) => String(field ?? "").trim() === "")) {
                throw new ApiError(400, "Each item requires salesInvoice, sku, productName, serialNumber, and productFault.");
            }

            const nextStatus = inputdata.jobStatus ? String(inputdata.jobStatus).toUpperCase() : "CREATED";
            if (!JOB_STATUSES.has(nextStatus)) {
                throw new ApiError(400, "Invalid repair job status.");
            }

            // Check if the job already exists
            // NOTE: "Dispatch" mapped to COMPLETED, same as insertRepairJob (see conversion notes #4)
            const existingJob = await prisma.repairJob.findFirst({
                where: {
                    serialNumber: inputdata.serialNumber,
                    jobStatus: { not: "COMPLETED" },
                },
            });
            if (existingJob) {
                throw new ApiError(409, "Repair job already exists.");
            }

            repairJob = await prisma.repairJob.create({
                data: {
                    raJobId: job_id,
                    organizationId,
                    customerId,
                    customerJobNo: jobInput.companyJobNo,
                    salesInvoice: inputdata.salesInvoice,
                    sku: inputdata.sku,
                    productName: inputdata.productName,
                    serialNumber: inputdata.serialNumber,
                    devicePassword: inputdata.devicePassword ? encryptDeviceCredential(inputdata.devicePassword) : null,
                    isDoa: asBoolean(inputdata.isDoa),
                    isProductUnderWarranty: asBoolean(inputdata.isProductUnderWarranty),
                    // is_product_working: ⚠️ no equivalent field on RepairJob — not persisted
                    cloudStatus: inputdata.cloudStatus ?? null,
                    cloudDetails: inputdata.cloudDetails || null,
                    productFault: inputdata.productFault,
                    videoUrl: inputdata.videoUrl || null,
                    customerTrackingNumber: inputdata.customerTrackingNumber || null,
                    jobStatus: nextStatus,
                    createdBy: Number(req.user.id),
                    createdRoleBy: req.user.role,
                    slaDueAt: new Date(Date.now() + 120 * 3600000),
                },
            });

            await prisma.repairJobTracking.create({
                data: {
                    repairJobId: repairJob.id,
                    status: repairJob.jobStatus,
                    changedBy: Number(req.user.id),
                },
            });

            // Prisma's create() already returns the full row — no need for a follow-up
            // findById() the way the old ORM apparently required.
            const createdRepairJob = repairJob;
            jobInfo.push(createdRepairJob);

            const uploadfiles = i === 0
                ? await storeUploadedFiles(req.files, createdRepairJob.id, "repair_job")
                : []

            let documents = []
            try {
                for(let j=0; j< uploadfiles.length; j++){
                    documents[j] = await prisma.document.create({
                        data: {
                            repairJobId: createdRepairJob.id,
                            relatedType: "repair_job",
                            relatedId: createdRepairJob.id,
                            documentName: uploadfiles[j].name,
                            documentUrl: uploadfiles[j].reference,
                            documentType: getDocumentType(uploadfiles[j].name),
                            uploadedBy: Number(req.user.id),
                            uploadedRole: req.user.role,
                            fileHash: uploadfiles[j].hash,
                        },
                    });
                }
            } catch (error) {
                await removeStoredFiles(uploadfiles);
                throw error;
            }

            //Log creation
            const log = {
                actorId: req.user.id,
                actorRole: req.user.role,
                description: `${req.user.firstName} ${req.user.lastName} created the RA Job ${job_id}`,
                logStatus: "Successful", // Assume success by default
            };

            if (!createdRepairJob) {
                log.logStatus = "Failure";
                await prisma.systemLog.create({ data: log });
                throw new ApiError(400, "Something went wrong while adding the repair job.");
            }

            // Attempt to send email
            try {
                await sendRepairJobStatusEmailSafely(createdRepairJob.id);
            } catch (emailError) {
                logger.error("Email sending failed:", emailError);
                log.description += ` (Email sending failed: ${emailError.message})`;
                log.logStatus = "Warning";
            }

            // Log the result of the process
            await prisma.systemLog.create({ data: log });
        }
        return res.status(201).json(new ApiResponse(201, jobInfo, "Repair jobs created successfully."))

    } catch (error) {
        throw safeServiceError(error, "repair-job.bulk-create", "Unable to add repair jobs.");
    }
})

// Get last inserted job from DB.
async function allocateRepairJobNumber(organizationId, storeCode) {
    const settings = await prisma.organizationSetting.upsert({
        where: { organizationId: Number(organizationId) },
        create: { organizationId: Number(organizationId), nextRmaNumber: 2 },
        update: { nextRmaNumber: { increment: 1 } },
        select: { nextRmaNumber: true },
    });
    return `${String(storeCode).trim().toUpperCase()}-${String(settings.nextRmaNumber - 1).padStart(6, "0")}`;
}


export {
    listRepairJob,
    insertRepairJob,
    updateRepairJobSKU,
    updateRepairJobSerialNumber,
    serialNumberLookup,
    updateTrackingNumber,
    updateStatus,
    updateDispatchId,
    insertMultipleRepairJobs,
    receiveJob,
    searchRepairJob,
    repairJob
}
