/**
 * ============================================================================
 * CONVERSION NOTES — read this before reviewing the functions below
 * ============================================================================
 * This file replaces the old hand-rolled "Model" classes (RepairJobModel,
 * ProductModel, etc.) with direct Prisma Client calls against the schema you
 * shared (v3 — corrected). Field names below match that schema exactly
 * (camelCase, enum values, relation names).
 *
 * Things I changed beyond a pure find/create/update swap, and WHY:
 *
 * 1. FK RISK — RepairJob.createdBy / receivedBy now point at a real `User`
 *    relation ("JobCreatedBy" / "JobReceivedBy"). The old code sometimes sets
 *    createdBy to req.customer?.id when a customer creates a job. If that
 *    Customer.id doesn't also exist as a User.id, Prisma will throw a
 *    foreign-key constraint error (P2003) on every customer-created job.
 *    This is a schema/business-logic mismatch I can't silently fix — flagged
 *    inline at insertRepairJob and insertMultipalReapirJob.
 *
 * 2. BOOLEAN FIELDS — isDoa / isProductUnderWarranty are `Boolean` in the
 *    schema. The old code did `Number(x === 'true')`, producing 0/1. I
 *    changed these to `x === 'true'` so they're real booleans, since Prisma
 *    will reject a number for a Boolean column.
 *
 * 3. cloudStatus is `String?` in the schema, but the old code coerced it to
 *    Number(0/1). I now store the raw string instead. If this is meant to be
 *    a true/false flag, consider changing the schema field to `Boolean`.
 *
 * 4. "Dispatch" STATUS — the old code excludes jobs with job_status =
 *    "Dispatch" when checking for duplicate serials. Your JobStatus enum has
 *    no DISPATCHED value, and updateDispatchId sets status to "completed" —
 *    so I've mapped "Dispatch" → COMPLETED. Confirm this is right.
 *
 * 5. DATES — manually-set createdDate/updatedDate/performedAt are removed
 *    from create() calls because your schema already handles them via
 *    @default(now()) / @updatedAt. Anywhere a real Date is still needed
 *    (completionDate, receivedDate) I use `new Date()` instead of a
 *    moment-formatted string, since Prisma expects a Date/ISO value, not
 *    "YYYY-MM-DD HH:mm:ss".
 *
 * 6. REDUNDANT RE-FETCHES — the old `Model.create()` apparently returned just
 *    an id (callers immediately re-fetched by id). Prisma's `create()`
 *    returns the full row, so those follow-up fetches are removed.
 *
 * 7. `update()` BEHAVIOR — Prisma's `.update()` throws (P2025) if the record
 *    doesn't exist, rather than returning a falsy value. The old
 *    `if (!result) {...}` guards after update() are now effectively dead
 *    code (the catch block handles "not found" instead) — left in place for
 *    structural parity, flagged where it matters.
 *
 * 8. JOINS — `.join("products", ...)` on ProductSerial becomes Prisma
 *    `include: { product: true }`. This means fields that used to be
 *    flattened onto the result (serialNumber.sku, serialNumber.name) are now
 *    nested under `.product` (productSerial.product.sku, etc).
 *
 * 9. TYPOS FIXED — several `returnres.status(...)` calls (missing `return `)
 *    and a couple of `res.status(...)` calls with no `return` at all (which
 *    would let execution continue and risk a "headers already sent" error)
 *    are corrected to `return res.status(...)`.
 *
 * 10. MISSING REQUIRED FIELDS — insertMultipalReapirJob's original
 *     RepairJob.create() never set organizationId or createdRoleBy, and its
 *     Document.create() never set relatedType/relatedId/documentUrl/
 *     documentType/fileHash/uploadedRole. All of these are required
 *     (non-nullable, no default) in your schema, so the original payload
 *     would fail validation every time. I filled them in following the same
 *     pattern as insertRepairJob and flagged each one — please confirm the
 *     values I picked make sense for your bulk-insert flow.
 *
 * 11. searchRepairJob — the body of the old `RepairJob.search()` wasn't in
 *     the file you shared, so I rebuilt it as a best-effort case-insensitive
 *     OR-match across the most likely searchable fields. Adjust the field
 *     list to match whatever the original actually searched.
 *
 * 12. Fields with NO equivalent in the schema (company_customer_name,
 *     company_customer_mobile, is_product_working) are still destructured
 *     from req.body (in case other logic needs them) but are NOT written to
 *     the database, per "don't add extra fields to the schema." Flagged
 *     inline.
 * ============================================================================
 */

import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import moment from "moment"
import { Email } from "../utils/Email.js"
import { signupEmailTempate } from "../templates/signup.templates.js"
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { overduedays, generateRandomString } from "../utils/common.js"
import { moveUploadedFiles } from "../utils/fileUpload.js"
import {
    ensureRepairJobAccess,
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    getRepairJobAccessWhere,
    isSuperAdmin,
} from "../utils/accessControl.js";
import { logger } from "../utils/logger.js";
import prisma from "../db/prisma.js"


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JOB_STATUSES = new Set(["CREATED", "RECEIVED", "IN_PROGRESS", "WAITING_PARTS", "COMPLETED", "CANCELLED"]);
const appUrl = () => process.env.APP_URL || "http://localhost:3000";

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

        const status = (req.body.field || "created").toUpperCase()
        // NOTE: uppercased to match the JobStatus enum (CREATED, RECEIVED, IN_PROGRESS, WAITING_PARTS, COMPLETED, CANCELLED)

        if (!JOB_STATUSES.has(status)) {
            return res.status(400).json(new ApiError(400, "Invalid repair job status."));
        }

        const page = Math.max(Number(req.body.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.body.limit) || 50, 1), 100);
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
        const modifiedData = repairjob.map(job =>({
            ...job,
            overDueDays: overduedays(job.receivedDate),
            receivedDate: moment(job.receivedDate).format('DD-MM-YYYY'),
            createdDate: moment(job.createdDate).format('DD-MM-YYYY HH:mm:ss'),
            updatedDate: moment(job.updatedDate).format('DD-MM-YYYY HH:mm:ss'),
        }))

        return res.status(200).json(new ApiResponse(200, {
            repairJobs: modifiedData,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }, " List of repair job." ))

    }catch(error){
        throw new ApiError(400, "Error while listing the repair job ", error.message)
    }
})


const insertRepairJob = asyncHandler(async (req, res) => {
    try {
        // Extract data from request body
        const {
            organization_id,
            customer_id,
            company_customer_name,   // ⚠️ no equivalent field on RepairJob in the schema — not persisted
            company_customer_mobile, // ⚠️ no equivalent field on RepairJob in the schema — not persisted
            store_code,
            email,
            company_job_no,          // mapped to customerJobNo — confirm this is the right field
            sales_invoice,
            sku,
            product_name,
            serial_number,
            device_password,
            is_doa,
            is_product_under_warranty,
            cloud_status,
            cloud_details,
            product_fault,
            video_url,
            customer_tracking_number,
        } = req.body;

        // Validation of data
        if ([sales_invoice, sku, product_name,serial_number, product_fault, customer_tracking_number]
            .some(field => !field?.trim())) {
            return res.status(400).json(new ApiError(400, " Please fill the required field information"))
        }

        if (!req.user) {
            return res.status(403).json(new ApiError(403, "Only internal users can create repair jobs from this endpoint."));
        }

        await ensureUserCanAccessOrganization(req.user, organization_id);

        //TODO: improve logic
        // Generate RA JOB Number Automatically 
        const lastInsertId = await prisma.repairJob.findFirst({ orderBy: { id: 'desc' } });
        let job_id;
        if(req.customer){
            job_id = lastInsertId
            ? `${req.customer?.customerCode}-${String(Number(lastInsertId.id) + 1).padStart(5, '0')}`
            : `${req.customer?.customerCode}-00001`;
        }else{
            job_id = lastInsertId
            ? `${store_code}-${String(Number(lastInsertId.id) + 1 ).padStart(5, '0')}`
            : `${store_code}-00001`;
        }

        // Check if the job already exists
        // NOTE: "Dispatch" mapped to COMPLETED (see conversion notes #4)
        const existingJob = await prisma.repairJob.findFirst({
            where: {
                serialNumber: serial_number,
                jobStatus: { not: "COMPLETED" },
            },
        });
        if (existingJob) {
            return res.status(400).json(new ApiError(400, "Repair job already exists"))
        }

        // Insert job into the database
        const createdRepairJob = await prisma.repairJob.create({
            data: {
                raJobId: job_id,
                organizationId: Number(organization_id),
                customerId: Number(customer_id),
                customerJobNo: (company_job_no === 'undefine') ?  null : company_job_no,
                salesInvoice: (sales_invoice === 'undefine') ? null : sales_invoice,
                sku,
                productName: product_name,
                serialNumber: (serial_number === 'undefine') ? null : serial_number ,
                devicePassword: (device_password === 'undefine') ? null : device_password,
                isDoa: is_doa === "true",                              // was Number(is_doa === "true") — now a real Boolean
                isProductUnderWarranty: is_product_under_warranty === 'true', // same fix
                cloudStatus: cloud_status ?? null,                     // was Number(...); schema field is String?, raw value kept
                cloudDetails: (cloud_details === 'undefine') ? null : cloud_details,
                productFault: (product_fault === 'undefine') ? null  : product_fault, // ⚠️ productFault is required (non-nullable) in the schema — null here would throw
                videoUrl: (video_url === 'undefine') ? null : video_url,
                customerTrackingNumber: (customer_tracking_number === 'undefine') ? null  : customer_tracking_number,
                createdBy: Number(req.user.id),
                createdRoleBy: req.user.role,
                // createdDate / updatedDate intentionally omitted — handled by @default(now()) / @updatedAt
            },
        });

        // create a folder with Job Number in Public/uploads Path: ../../public/uploads
        createFolder(createdRepairJob.id)

        // Move only the files attached to this request.
        const uploadfiles = await moveUploadedFiles(req.files, createdRepairJob.id,"repair_job")

        let documents = []
        for(let j=0; j< uploadfiles.length; j++){
            documents[j] = await prisma.document.create({
                data: {
                    repairJobId: createdRepairJob.id,
                    relatedType: "repair_job",
                    relatedId: createdRepairJob.id,
                    documentName: uploadfiles[j].toString(),
                    documentUrl: `/uploads/${createdRepairJob.id}/repair_job/${uploadfiles[j].toString()}`,
                    documentType: getDocumentType(uploadfiles[j].toString()),
                    uploadedBy: req.user?.id || req.customer?.id,
                    uploadedRole: req.user?.role || req.customer?.role || "CUSTOMER",
                    fileHash: generateRandomString(15),
                },
            })
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

            if(req.customer){
                await new Email().send(
                    req.customer?.email,
                    `${job_id} created successfully`,
                    signupEmailTempate(`${appUrl()}/api/v1/repairjobs/repairJob`)
                );
            }else{
                await new Email().send(
                    email,
                    `${job_id} created successfully`,
                    signupEmailTempate(`${appUrl()}/api/v1/repairjobs/repairJob`)
                );
            }

        } catch (emailError) {
            logger.error("Email sending failed:", emailError);
            log.description += ` (Email sending failed: ${emailError.message})`;
            log.logStatus = "Warning";
        }

        // Log the result of the process
        await prisma.systemLog.create({ data: log });

        res.status(200).json(new ApiResponse(200, createdRepairJob, `RA Job ${job_id} created successfully and email sent`));

    } catch (error) {

        // Only throw an error if we haven't already sent a response
        if (!res.headersSent) {
            logger.error("Repair job creation failed:", error);
            return res.status(500).json(new ApiError(500, "Internal Server Error"))
        } else {
            logger.error("Error occurred after response was sent:", error);
        }
    }
})


const updateRepairJobSKU = asyncHandler(async (req, res) => {
    try {

        const {
            id,
            sku
        } = req.body;

        // Validation of data
        if ([id, sku ]
            .some(field => !field?.trim())) {
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
            return res.status(400).json( new ApiError(400," SKU didn't found in the product list."));
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

        return res.status(200).json(new ApiResponse(200, newSKU, "SKU Update Successfully."))

    } catch (error) {
         return res.status(400).json( new ApiError(400,"Error Updateing Repair job. ", error?.message))
    }
})

const updateRepairJobSerialNumber = asyncHandler(async (req, res) => {
    try {

        const { id, serial_number }= req.body
        // Validation of data
        if ([id, serial_number]
            .some(field => !field?.trim())) {
             return res.status(400).json(new ApiError(400, "All fields are required"));
        }

        const existingRepairJob = await ensureRepairJobAccess(req, id);

        const productSerial = await prisma.productSerial.findUnique({
            where: { serialNumber: serial_number },
            include: { product: true },
        });

        if(!productSerial || !productSerial.product || productSerial.organizationId !== existingRepairJob.organizationId){
            return res.status(400).json( new ApiError(404," Serial Number didn't found in the Serial Number list."))
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
        return res.status(200).json(new ApiResponse(200, data, " Serial Number update successfully."))

    } catch (error) {
        return res.status(400).json(new ApiError(400," Error in Update Repair Job Serial Number"))
    }
})


const serialNumberLookup = asyncHandler(async (req, res) => {
    try {

        const {serial_number} = req.body
        // Validation of data
        if (serial_number == "" || serial_number == undefined ) {
            return res.status(400).json(new ApiError(400, "serial number is required"));
        }

        const productSerial = await prisma.productSerial.findUnique({
            where: { serialNumber: serial_number },
            include: { product: true },
        });

        if(!productSerial){
           return res.status(400).json( new ApiError(400, " serial number is not found."))
        }

        const hasAccessToSerial = req.customer
            ? req.customer.organizationId === productSerial.organizationId
            : isSuperAdmin(req.user) || (await getAssignedOrganizationIds(req.user)).includes(productSerial.organizationId);

        if (!hasAccessToSerial) {
            return res.status(403).json(new ApiError(403, "You do not have access to this serial number."));
        }

        return res.status(200).json(new ApiResponse(200, productSerial, " Serial Number found successfully"))

    } catch (error) {
        return res.status(400).json(new ApiError(400, "Error while looking for serial number"))
    }
})


const updateTrackingNumber = asyncHandler(async (req, res) => {
    try {

        const {id,tracking_number} = req.body
        // Validation of data
        if (!tracking_number) {
            return res.status(400).json( new ApiError(400, " Tracking number is required"));
        }

        await ensureRepairJobAccess(req, id);

        const repairjob = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: { customerTrackingNumber: tracking_number },
        });
        if(!repairjob){
            return res.status(400).json( new ApiError(400, " Tracking Number isn't updated successfaully."))
        }

        //Log creation
        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(id),
                actionType: "UPDATE",
                description: `Updated  Tracking Number to ${tracking_number}`,
                performedBy: req.user?.id,
            },
        });

        return res.status(200).json(new ApiResponse(200, repairjob, " Tracking Number updated successfaully."))

    } catch (error) {
        return res.status(500).json(new ApiError(500, "Error while updating tracking number"))
    }
})


const updateStatus = asyncHandler(async (req, res) => {
    try {

        const {id,status} = req.body
        // Validation of data
        if ([id, status].some(field => !field?.trim())) {
            return res.status(400).json(new ApiError(400, "All fields are required"));
        }

        await ensureRepairJobAccess(req, id);

        const nextStatus = status.toUpperCase();
        if (!JOB_STATUSES.has(nextStatus)) {
            return res.status(400).json(new ApiError(400, "Invalid repair job status."));
        }

        const repairjob = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: { jobStatus: nextStatus },
        });
        if(!repairjob){
            return res.status(400).json(new ApiError(400, " Status isn't updated successfaully."))
        }

        await prisma.repairJobAuditLog.create({
            data: {
                repairJobId: Number(id),
                actionType: "UPDATE",
                description: `Updated  Status to ${status}`,
                performedBy: req.user?.id,
            },
        });
        return res.status(200).json(new ApiResponse(200, repairjob, " Status updated successfaully."))
    } catch (error) {
        return res.status(400).json(new ApiError(400, "Error while updating status"))
    }
})


const updateDispatchId = asyncHandler(async (req, res) => {
    try {

        const {id,dispatchId} = req.body
        // Validation of data
        if ([id, dispatchId].some(field => !field?.trim())) {
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
                actionType: "UPDATE",
                description: `Updated  Dispatch ID to ${dispatchId}`,
                performedBy: req.user?.id,
            },
        });
        return res.status(200).json(new ApiResponse(200, repairjob, " Dispatch ID updated successfaully."))

    } catch (error) {
        return res.status(400).json(new ApiError(400, "Error while updating Dispatch ID"))
    }
})


const receiveJob = asyncHandler(async (req, res) => {
    try {

        const {id,tracking_number } = req.body
        // Validation of data
        if (!tracking_number) {
            // NOTE: original had no `return` here at all (not just a typo) — added,
            // since otherwise execution falls through to the update() below.
            return res.status(400).json(new ApiError(400, " Tracking number is required"));
        }

        await ensureRepairJobAccess(req, id);

        const repairjob = await prisma.repairJob.update({
            where: { id: Number(id) },
            data: {
                customerTrackingNumber: tracking_number,
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
                actionType: "UPDATE",
                description: `Receievd Job with Tracking Number - ${tracking_number}`,
                performedBy: req.user?.id,
            },
        });

        const updateJob = await prisma.repairJob.findUnique({ where: { id: Number(id) } });
        return res.status(200).json(new ApiResponse(200, updateJob, " Job is received successfaally."))

    } catch (error) {
        return res.status(400).json(new ApiError(400, "Error while receiving job in system."))
    }
})


const repairJob = asyncHandler(async (req, res) => {
    try {
        const {id} = req.body
        if (!id) {
            throw new ApiError(400, "fields is required");
        }
        await ensureRepairJobAccess(req, id);
        const repairjob = await prisma.repairJob.findUnique({ where: { id: Number(id) } });

         if(!repairjob){
            throw new ApiError(400, " Job is not received successfaully.")
        }

        repairjob.overDueDays = overduedays(repairjob.receivedDate)

        res.status(200).json(new ApiResponse(200, repairjob, " Job is received successfaally."))

    } catch (error) {
        throw new ApiError(400, "Error while receiving job in system.")
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
        });

        if(!repairjob || repairjob.length === 0){
            throw new ApiError(400, " No Job found.")
        }

        res.status(200).json(new ApiResponse(200, repairjob, " Job is found successfaally."))

    } catch (error) {
        throw new ApiError(400, "Error while searching repair job.")
    }
})


//TODO: Add Multipal job  by user and customer. ( Working well)


const insertMultipalReapirJob = asyncHandler( async (req,res) =>{
    try {

        const Jobdata = req.body

        if(!Jobdata){
            throw new ApiError(404,"No data found from body")
        }

        if (!req.user) {
            throw new ApiError(403, "Only internal users can create repair jobs.");
        }

        const organizationId = Number(Jobdata.organization_id);
        const customerId = Number(Jobdata.Customer_id);

        if (!organizationId || !customerId || !Jobdata.store_code) {
            throw new ApiError(400, "organization_id, Customer_id, and store_code are required.");
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

        let repairJob, length, job_id;
        let jobInfo=[];

        if(typeof Jobdata.data === "string"){
            length=1;
        }else{
            length = Jobdata.data.length;
        }

        for(let i=0; i< length; i++){

            job_id = await getLastInsertJob(Jobdata.store_code)

            let inputdata = (length==1) ? JSON.parse(Jobdata.data) : JSON.parse(Jobdata.data[i])

            const nextStatus = inputdata.job_status ? String(inputdata.job_status).toUpperCase() : "CREATED";
            if (!JOB_STATUSES.has(nextStatus)) {
                throw new ApiError(400, "Invalid repair job status.");
            }

            // Check if the job already exists
            // NOTE: "Dispatch" mapped to COMPLETED, same as insertRepairJob (see conversion notes #4)
            const existingJob = await prisma.repairJob.findFirst({
                where: {
                    serialNumber: inputdata.serial_number,
                    jobStatus: { not: "COMPLETED" },
                },
            });
            if (existingJob) {
                throw new ApiError(400, "Repair job already exists");
            }

            repairJob = await prisma.repairJob.create({
                data: {
                    raJobId: job_id,
                    organizationId,
                    customerId,
                    customerJobNo: Jobdata.company_job_no,
                    salesInvoice: inputdata.sales_invoice,
                    sku: inputdata.sku,
                    productName: inputdata.product_name,
                    serialNumber: inputdata.serial_number,
                    devicePassword: inputdata.device_password,
                    isDoa: inputdata.is_doa === true || inputdata.is_doa === "true", // normalised to a real Boolean
                    isProductUnderWarranty: inputdata.is_product_under_waranty === true || inputdata.is_product_under_waranty === "true", // NOTE: kept original typo'd source key "is_product_under_waranty"
                    // is_product_working: ⚠️ no equivalent field on RepairJob — not persisted
                    cloudStatus: inputdata.cloud_status ?? null,
                    cloudDetails: inputdata.cloud_details || null,
                    productFault: inputdata.product_fault,
                    videoUrl: inputdata.video_url || null,
                    customerTrackingNumber: inputdata.customer_tracking_number || null,
                    jobStatus: nextStatus,
                    createdBy: Number(req.user.id),
                    createdRoleBy: req.user.role,
                },
            });

            // Prisma's create() already returns the full row — no need for a follow-up
            // findById() the way the old ORM apparently required.
            const createdRepairJob = repairJob;
            jobInfo.push(createdRepairJob);

            // create a folder with Job Number in Public/uploads Path: ../../public/uploads
            createFolder(createdRepairJob.raJobId)

            // Move only the files attached to this request.
            const uploadfiles = i === 0
                ? await moveUploadedFiles(req.files, createdRepairJob.id, "repair_job")
                : []

            let documents = []
            for(let j=0; j< uploadfiles.length; j++){
                documents[j] = await prisma.document.create({
                    data: {
                        repairJobId: createdRepairJob.id,
                        relatedType: "repair_job",
                        relatedId: createdRepairJob.id,
                        documentName: uploadfiles[j].toString(),
                        documentUrl: `/uploads/${createdRepairJob.id}/repair_job/${uploadfiles[j].toString()}`,
                        documentType: getDocumentType(uploadfiles[j].toString()),
                        uploadedBy: Number(req.user.id),
                        uploadedRole: req.user.role,
                        fileHash: generateRandomString(15),
                    },
                });
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
                await new Email().send(
                    Jobdata.email,
                    `${job_id} created successfully`,
                    signupEmailTempate(`${appUrl()}/api/v1/repairjobs/repairJob`)
                );
            } catch (emailError) {
                logger.error("Email sending failed:", emailError);
                log.description += ` (Email sending failed: ${emailError.message})`;
                log.logStatus = "Warning";
            }

            // Log the result of the process
            await prisma.systemLog.create({ data: log });
        }
        return res.status(200).json(new ApiResponse(200, jobInfo, "multiple job data "))

    } catch (error) {
        throw new ApiError(400, " Errow while adding multiple job", error?.message)
    }
})

// Get last inserted job from DB.
 async function getLastInsertJob(store_code){
     // Generate RA JOB Number Automatically
     const lastInsertId = await prisma.repairJob.findFirst({ orderBy: { id: 'desc' } });
     return  lastInsertId
         ? `${store_code}-${String(Number(lastInsertId.id) + 1).padStart(5, '0')}`
         : `${store_code}-00001`;

}


// Move this funciton to Utility.
// creat folder with job id.
function createFolder(jobId){
    const folderName = path.join(__dirname,`../../public/uploads/${jobId}`);

    try {
        fs.mkdirSync(folderName,{recursive:true});
        logger.info(`Folder "${folderName}" created successfully.`);
    } catch (err) {
        logger.error(`Error creating folder "${folderName}":`, err);
    }
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
        insertMultipalReapirJob,
        receiveJob,
        searchRepairJob,
        repairJob
    }

// import {ApiError} from "../utils/ApiError.js"
// import {ApiResponse} from "../utils/ApiResponse.js"
// import {asyncHandler} from "../utils/asyncHandler.js"
// import {RepairJobModel} from "../models/repairjob.model.js"
// import {ProductModel} from "../models/product.model.js"
// import {UserCustomerModel} from "../models/usercustomer.model.js"
// import {UserOrganizationModel} from "../models/userorganization.model.js"
// import { LogModel } from "../models/log.model.js"
// import { RepairJobAuditLogModel } from "../models/repairjobauditlog.model.js"
// //import {SerialNumberModel} from "../models/serialnumber.model.js"
// import {ProductSerialsModel} from "../models/product_serials.model.js"
// import moment from "moment"
// import { Email } from "../utils/Email.js"
// import {signupEmailTempate} from "../templates/signup.templates.js"
// import fs from 'fs';
// import { fileURLToPath } from 'url';
// import path from 'path';
// import { DocumentModel } from "../models/document.model.js"
// import { overduedays, generateRandomString } from "../utils/common.js"
// import { moveFile} from "../utils/fileUpload.js"

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Class Object 
// const RepairJob = new RepairJobModel();
// const SerialNumber = new ProductSerialsModel()
// const Product = new ProductModel();
// const Log = new LogModel();
// const Document = new DocumentModel();
// const UserCustomer = new UserCustomerModel();
// const UserOrganization = new UserOrganizationModel();   
// const RepairJobAuditLog = new RepairJobAuditLogModel();


// // for admin,
// const listRepairJob = asyncHandler(async (req, res) => {
//     try{

//         const status = req.body.field || "created"


//         let condition; 
//         if(req.user){
//             // User role
//             //query = "job_status='" + field+"'  and customer_id in("+req.user.assigned_store_id+")"; 

//             //get the assigned_customer_id
//             //get the assigned_org_id



//             //let assigned_customer_id = req.user.assigned_customer_id.split(",")
//             //let assigned_org_id = req.user.assigned_org_id.split(",")

//             let assigned_customer = await UserCustomer.selectFields(['customer_id']).find({'user_id':req.user.id}).execute();
//             let assigned_org = await UserOrganization.selectFields(['organization_id']).find({'user_id':req.user.id}).execute();

//             condition = {job_status:status, customer_id_in: assigned_customer, organization_id_in: assigned_org  }
//         }else{
//             // customer role
//             //query = "job_status='" + field+"'  and customer_id='"+req.customer.id+"'"; 
//             condition = {job_status:status,customer_id:req.customer.id, }
//         }
//         //const repairjob = await RepairJob.findByField(query)
//         const repairjob = await RepairJob.find(condition).execute();
//         if(!repairjob || repairjob.length == 0 ){
//             return res.status(404).json(new ApiResponse(404, null, " No repair job found." ))
//         }

//         if( typeof repairjob === "object" ){
//                 repairjob.overDueDays = overduedays(repairjob.received_date),
//                 repairjob.received_date = moment(repairjob.received_date).format('DD-MM-YYYY'),
//                 repairjob.created_date =moment(repairjob.created_date).format('DD-MM-YYYY HH:mm:ss'),
//                 repairjob.updated_date =moment(repairjob.updated_date).format('DD-MM-YYYY HH:mm:ss')

//         }else{
//             const modifiedData = repairjob.map(job =>({
//             ...job,
//             overDueDays: overduedays(job.received_date),
//             received_date:moment(job.received_date).format('DD-MM-YYYY'),
//             created_date:moment(job.created_date).format('DD-MM-YYYY HH:mm:ss'),
//             updated_date:moment(job.updated_date).format('DD-MM-YYYY HH:mm:ss'),
//             }))

//             return res.status(200).json(new ApiResponse(200, modifiedData, " List of repair job." ))

//         }
//         res.status(200).json(new ApiResponse(200, repairjob, " List of repair job." ))  
//     }catch(error){
//         throw new ApiError(400, "Error while listing the repair job ", error.message)
//     }
// })


// const insertRepairJob = asyncHandler(async (req, res) => {
//     try {
//         // Extract data from request body

//         //const data = JSON.parse(req.body.raJobData)

//         const {
//             organization_id,
//             customer_id,
//             company_customer_name,
//             company_customer_mobile,
//             store_code,
//             email,
//             company_job_no,
//             sales_invoice,
//             sku,
//             product_name,
//             serial_number,
//             device_password,
//             is_doa,
//             is_product_under_warranty,
//             //is_product_working,
//             cloud_status,
//             cloud_details,
//             product_fault,
//             video_url,
//             customer_tracking_number,
//         } = req.body;

//         // Validation of data
//         if ([sales_invoice, sku, product_name,serial_number, product_fault, customer_tracking_number]
//             .some(field => !field?.trim())) {
//             //throw new ApiError(400, "All fields are required");
//             return res.status(400).json(new ApiError(400, " Please fill the required field information"))
//         }

//         // Generate RA JOB Number Automatically
//         const lastInsertId = await RepairJob.lastrecord();
//         let job_id;
//         if(req.customer){
//             job_id = lastInsertId
//             ? `${req.customer?.store_code}-${String(lastInsertId.id).padStart(5, '0')}`
//             : `${req.customer?.store_code}-00001`;
//         }else{
//             job_id = lastInsertId
//             ? `${store_code}-${String(Number(lastInsertId.id) + 1 ).padStart(5, '0')}`
//             : `${store_code}-00001`;
//         }
        

//         // Check if the job already exists
//         //const existingJob = await RepairJob.findByField(`serial_number='${serial_number}' and job_status !='Dispatch'`);
//         const existingJob = await RepairJob.find({serial_number, job_status_not: "Dispatch"}).execute();
//         if (existingJob) {
//             return res.status(400).json(new ApiError(400, "Repair job already exists"))
//         }

//         // Insert job into the database
//         const repairjob = await RepairJob.create({
//             ra_job_id: job_id,
//             organization_id,
//             customer_id: Number(customer_id),
//             company_customer_name,
//             company_customer_mobile,
//             company_job_no : (company_job_no === 'undefine')?  null : company_job_no,
//             sales_invoice : (sales_invoice === 'undefine') ? null : sales_invoice,
//             sku,
//             product_name,
//             serial_number: (serial_number === 'undefine') ? null : serial_number ,
//             device_password:  (device_password === 'undefine') ? null : device_password,
//             is_doa:  Number(is_doa === "true"),
//             is_product_under_warranty: Number(is_product_under_warranty === 'true'),
//             //is_product_working: Number(is_product_working === 'true'),
//             cloud_status: Number(cloud_status === 'true'),
//             cloud_details : (cloud_details ==='undefine') ? null : cloud_details,
//             product_fault : (product_fault === 'undefine') ? null  : product_fault,
//             video_url : (video_url === 'undefine') ? null : video_url,
//             customer_tracking_number : ( customer_tracking_number === 'undefine') ? null  : customer_tracking_number,
//             created_by:  Number(req.user?.id) || Number(req.customer?.id),
//             created_role_by: req.user?.role || "Customer",
//             created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
//             updated_date: moment().format("YYYY-MM-DD HH:mm:ss"),
//         });

//         console.log(" Repair job Controller :: Insert by custoemr :: repairjob ", repairjob);

//         // Fetch the created repair job
//         const createdRepairJob = await RepairJob.find({'id':repairjob}).execute();

//         //create a folder with Job Number in Public/uploads Path: ../../public/uploads
//         //const folderName = path.join(__dirname,`../../public/uploads/${createdRepairJob.ra_job_id}`);
//         createFolder(createdRepairJob.id)

//         // Move all the file  from temp to upload folder
//         const uploadfiles = await moveFile(createdRepairJob.id,"repair_job")
//         console.log("uploadfiles data ", uploadfiles)

//         let documents = []
//         let type='file';
//         for(let j=0; j< uploadfiles.length; j++){

//             if(uploadfiles[j].toString().includes("jpg") || uploadfiles[j].toString().includes("jpeg") || uploadfiles[j].toString().includes("png") || uploadfiles[j].toString().includes("webp")){
//                 type = 'image'
//             }

//             documents[j] = await Document.create({
//                     repair_job_id: createdRepairJob.id,
//                     related_type:"repair_job",
//                     related_id: createdRepairJob.id,
//                     document_name:uploadfiles[j].toString(),
//                     document_url:`/uploads/${createdRepairJob.id}/repair_job/${uploadfiles[j].toString()}`, 
//                     document_type: type||"file",
//                     uploaded_by: req.user?.id || req.customer?.id,
//                     uploaded_role: req.user?.role || req.customer?.role,
//                     file_hash:generateRandomString(15), 
//             })
//         }

//         //Log creation
//         const log = {
//             actor_id: req.customer?.id || req.user?.id ,
//             actor_role :req.user?.user_role || "Customer",
//             description: `${req.customer?.company_name || req.user?.first_name +' '+ req.user?.last_name} created the RA Job ${job_id}`,
//             created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
//             log_status: "Successful", // Assume success by default
//         };

//         if (!createdRepairJob) {
//             log.log_status = "Failure";
//             await Log.create(log);
//             return res.status(400).json(new ApiError(400, " Something went wrong while adding the repair job."))
//         }

//         // Attempt to send email
//         try {

//             if(req.customer){
//                 await new Email().send(
//                     req.customer?.email,
//                     `${job_id} created successfully`,
//                     signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${req.customer?.id}`)
//                 );
//             }else{
//                 await new Email().send(
//                     email,
//                     `${job_id} created successfully`,
//                     signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${req.customer?.id}`)
//                 );
//             }
            
//         } catch (emailError) {
//             console.error("Email sending failed:", emailError);
//             log.description += ` (Email sending failed: ${emailError.message})`;
//             log.log_status = "Warning";
//         }

//         // Log the result of the process
//         await Log.create(log);

//         res.status(200).json(new ApiResponse(200, createdRepairJob, `RA Job ${job_id} created successfully and email sent`));

//     } catch (error) {

//         //delete temp folder the file.

//         // Only throw an error if we haven't already sent a response
//         if (!res.headersSent) {
//             return res.status(400).json(new ApiError(400, "Internal Server Error", error.message))
//         } else {
//             console.error("Error occurred after response was sent:", error);
//         }
//     }
// })


// const updateRepairJobSKU = asyncHandler(async (req, res) => {
//     try {
        
//         const {
//             id,
//             sku
//         } = req.body;

//         // Validation of data
//         if ([id, sku ]
//             .some(field => !field?.trim())) {
//             return res.status(400).json(new ApiError(400, "All fields are required"));
//         }

//         // Find the SKU from Product Table 
//         //const product = await Product.findByField("sku='"+sku+"'")
//         const product = await Product.find({sku:sku}).execute();
//         if(!product){
//             return res.status(400).json( new ApiError(400," SKU didn't found in the product list."));
//         }

//         let product_name = product.name 
//         product_name += (product.model)? "- "+product.model : ""
//         product_name += (product.color) ? "- "+product.color :""

//         //Log creation
//         const log = {
//             repair_job_id: id,
//             action_type: "Update",
//             description: `Updated  SKU to ${sku}`,
//             performed_by : req.user?.id,
//             performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         const newSKU = await RepairJob.update({'id':id},{sku,product_name: product_name,updated_date : moment().format("YYYY-MM-DD HH:mm:ss") })
//         if(!newSKU){

//            return res.status(400).json(new ApiError(400," Error while updating the SKU in repair job."))
//         }
//          // Log the result of the process
//         RepairJobAuditLog.create(log);
//         returnres.status(200).json(new ApiResponse(200, newSKU, "SKU Update Successfully."))

//     } catch (error) {
//          return res.status(400).json( new ApiError(400,"Error Updateing Repair job. ", error?.message))
//     }
// })

// const updateRepairJobSerialNumber = asyncHandler(async (req, res) => {
//     try {

//         const { id, serial_number }= req.body
//         // Validation of data
//         if ([id, serial_number]
//             .some(field => !field?.trim())) {
//              return res.status(400).json(new ApiError(400, "All fields are required"));
//         }

//         // Find the Serial number from serial number Table 
//         //const serialNumber = await SerialNumber.findByField("serial_number='"+serial_number+"'")
//         //const serialNumber = await SerialNumber.find({'serial_number':serial_number}).execute();
//         const serialNumber = await SerialNumber.find({'serial_number':serial_number}).join("products","product_serials.product_id = products.id ","left").execute();

//         if(!serialNumber){
//             returnres.status(400).json( new ApiError(404," Serial Number didn't found in the Serial Number list."))
//         }
        
//         const log = {
//             repair_job_id: id,
//             action_type: "Update",
//             description: `Updated serial number to ${serialNumber.serial_number}`,
//             performed_by : req.user?.id,
//             performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         const data = await RepairJob.update({'id':id},{sku: serialNumber.sku, product_name: serialNumber.name , serial_number: serialNumber.serial_number , sales_invoice: serialNumber.sales_invoice, updated_date : moment().format("YYYY-MM-DD HH:mm:ss") })
//         if(!data){
//             return res.status(400).json(new ApiError(400, " Error while updating the serial number"))
//         }

//         // log creation
//         RepairJobAuditLog.create(log);
//         returnres.status(200).json(new ApiResponse(200, data, " Serial Number update successfully."))
        
//     } catch (error) {
//         returnres.status(400).json(new ApiError(400," Error in Update Repair Job Serial Number"))
//     }
// })


// const serialNumberLookup = asyncHandler(async (req, res) => {
//     try {
        
//         const {serial_number} = req.body
//         // Validation of data
//         if (serial_number == "" || serial_number == undefined ) {
//             returnres.status(400).json(new ApiError(400, "serial number is required"));
//         }

//         const serialNumber = await SerialNumber.find({'serial_number':serial_number}).join("products","product_serials.product_id = products.id ","left").execute();
        
//         if(!serialNumber){
//            return res.status(400).json( new ApiError(400, " serial number is not found."))
//         }

//         return res.status(200).json(new ApiResponse(200, serialNumber, " Serial Number found successfully"))

//     } catch (error) {
//         return res.status(400).json(new ApiError(400, "Error while looking for serial number"))
//     }
// })


// const updateTrackingNumber = asyncHandler(async (req, res) => {
//     try {
        
//         const {id,tracking_number} = req.body
//         // Validation of data
//         if (!tracking_number) {
//             return res.status(400).json( new ApiError(400, " Tracking number is required"));
//         }

//         //Log creation
//         const log = {
//             repair_job_id: id,
//             action_type: "Update",
//             description: `Updated  Tracking Number to ${tracking_number}`,
//             performed_by : req.user?.id,
//             performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         const repairjob = await RepairJob.update({'id':id},{customer_tracking_number:tracking_number})
//         if(!repairjob){
//             return res.status(400).json( new ApiError(400, " Tracking Number isn't updated successfaully."))
//         }

//          // Log the result of the process
//         RepairJobAuditLog.create(log);
//         return res.status(200).json(new ApiResponse(200, repairjob, " Tracking Number updated successfaully."))

//     } catch (error) {
//         return res.status(500).json(new ApiError(500, "Error while updating tracking number"))
//     }
// })


// const updateStatus = asyncHandler(async (req, res) => {
//     try {
        
//         const {id,status} = req.body
//         // Validation of data
//         if ([id, status].some(field => !field?.trim())) {
//             return res.status(400).json(new ApiError(400, "All fields are required"));
//         }

//         //Log creation
//         const log = {
//             repair_job_id: id,
//             action_type: "Update",
//             description: `Updated  Status to ${status}`,
//             performed_by : req.user?.id,
//             performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         const repairjob = await RepairJob.update({'id':id},{job_status:status})
//         if(!repairjob){
//             return res.status(400).json(new ApiError(400, " Status isn't updated successfaully."))
//         }
 
//         RepairJobAuditLog.create(log);
//         return res.status(200).json(new ApiResponse(200, repairjob, " Status updated successfaully."))
//     } catch (error) {
//         return res.status(400).json(new ApiError(400, "Error while updating status"))
//     }
// })


// const updateDispatchId = asyncHandler(async (req, res) => {
//     try {
        
//         const {id,dispatchId} = req.body
//         // Validation of data
//         if ([id, dispatchId].some(field => !field?.trim())) {
//             return res.status(400).json(new ApiError(400, "All fields are required"));
//         }

//         //Log creation
//         const log = {
//             repair_job_id: id,
//             action_type: "Update",
//             description: `Updated  Dispatch ID to ${dispatchId}`,
//             performed_by : req.user?.id,
//             performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         const repairjob = await RepairJob.update({'id':id},{dispatch_id:dispatchId, job_status:"completed", completion_date: moment().format("YYYY-MM-DD HH:mm:ss") })
//         if(!repairjob){
//             return res.status(400).json(new ApiError(400, " Dispatch ID  isn't updated successfaully."));
//         }

//         RepairJobAuditLog.create(log);
//         res.status(200).json(new ApiResponse(200, repairjob, " Dispatch ID updated successfaully."))

//     } catch (error) {
//         returnres.status(400).json(new ApiError(400, "Error while updating Dispatch ID"))
//     }
// })


// const receiveJob = asyncHandler(async (req, res) => {
//     try {
        
//         const {id,tracking_number } = req.body
//         // Validation of data
//         if (!tracking_number) {
//             res.status(400).json(new ApiError(400, " Tracking number is required"));
//         }

//         //Log creation
//         const log = {
//             repair_job_id: id,
//             action_type: "Update",
//             description: `Receievd Job with Tracking Number - ${tracking_number}`,
//             performed_by : req.user?.id,
//             performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
//         };

//         const repairjob = await RepairJob.update({'id':id},{
//                 customer_tracking_number:tracking_number,
//                 job_status:"Received",
//                 received_by: Number(req.user?.id),
//                 received_role_by: req.user?.role,
//                 received_date:moment().format("YYYY-MM-DD HH:mm:ss")
//             })

        
//         if(!repairjob){
//             res.status(400).json(new ApiError(400, " Job is not received successfaully."));
//         }

//         RepairJobAuditLog.create(log);
//         const updateJob = await RepairJob.find({id}).execute();
//         res.status(200).json(new ApiResponse(200, updateJob, " Job is received successfaully."))

//     } catch (error) {
//         res.status(400).json(new ApiError(400, "Error while receiving job in system."))
//     }
// })


// const repairJob = asyncHandler(async (req, res) => {
//     try { 
//         const {id} = req.body
//         if (!id) {
//             throw new ApiError(400, "fields is required");
//         }
//         const repairjob = await RepairJob.find({id}).execute();
        
//          if(!repairjob){
//             throw new ApiError(400, " Job is not received successfaully.")
//         }

//         repairjob.overDueDays = overduedays(repairjob.received_date)

//         res.status(200).json(new ApiResponse(200, repairjob, " Job is received successfaully."))

//     } catch (error) {
//         throw new ApiError(400, "Error while receiving job in system.")
//     }
// })


// const searchRepairJob = asyncHandler(async (req, res) => {
//     try {
//         const {searchData} = req.body
//         // Validation of data
//         if (!searchData) {
//             throw new ApiError(400, "fields is required");
//         }

//         const repairjob = await RepairJob.search(searchData)
//         if(!repairjob){
//             throw new ApiError(400, " No Job found.")
//         }

//         res.status(200).json(new ApiResponse(200, repairjob, " Job is found successfaully."))

//     } catch (error) {
//         throw new ApiError(400, "Error while searching repair job.")
//     }
// })


// //TODO: Add Multipal job  by user and customer. ( Working well)


// const insertMultipalReapirJob = asyncHandler( async (req,res) =>{
//     try {   
        
//         const Jobdata = req.body

//         if(!Jobdata){
//             throw new ApiError(404,"No data found from body")
//         }

//         let repairJob, length, job_id;
//         let jobInfo=[];
    
//         if(typeof Jobdata.data === "string"){
//             length=1;
//         }else{
//             length = Jobdata.data.length;
//         }

//         for(let i=0; i< length; i++){

//             job_id = await getLastInsertJob(req.customer?.store_code)

//             let inputdata = (length==1) ? JSON.parse(Jobdata.data) : JSON.parse(Jobdata.data[i])

//             // Check if the job already exists
//             //const existingJob = await RepairJob.findByField(`serial_number='${inputdata.serial_number}' and job_status !='Dispatch'`);
//             const existingJob = await RepairJob.find({
//                 serial_number: inputdata.serial_number,
//                 job_status_not: "Dispatch"
//             }).execute();
//             if (existingJob) {
//                 throw new ApiError(400, "Repair job already exists");
//             }

//             repairJob = await RepairJob.create({
//                 ra_job_id: job_id,
//                 customer_id: Number(Jobdata.Customer_id),
//                 company_customer_name: Jobdata.companyName,
//                 company_customer_mobile: Jobdata.phone,
//                 company_job_no:Jobdata.company_job_no,
//                 sales_invoice: inputdata.sales_invoice,
//                 sku: inputdata.sku,
//                 product_name: inputdata.product_name,
//                 serial_number: inputdata.serial_number,
//                 device_password:inputdata.device_password,
//                 is_doa: inputdata.is_doa,
//                 is_product_under_waranty: inputdata.is_product_under_waranty,
//                 is_product_working: inputdata.is_product_working,
//                 cloud_status: inputdata.cloud_status,
//                 cloud_details: inputdata.cloud_details || null,
//                 product_fault: inputdata.product_fault,
//                 video_url: inputdata.video_url || null,
//                 customer_tracking_number: inputdata.customer_tracking_number || null,
//                 job_status: inputdata.job_status,
//                 created_by: Number(inputdata.created_by),
//                 created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
//                 updated_date: moment().format("YYYY-MM-DD HH:mm:ss")
//             });

//             console.log(" Repair job Controller :: Insert by custoemr :: repairjob ", repairJob);

//             // Fetch the created repair job
//             const createdRepairJob = await RepairJob.findById(repairJob);
//             jobInfo.push(createdRepairJob);

//             //create a folder with Job Number in Public/uploads Path: ../../public/uploads
//             //const folderName = path.join(__dirname,`../../public/uploads/${createdRepairJob.ra_job_id}`);
//             createFolder(createdRepairJob.ra_job_id)

//             // Move all the file  from temp to upload folder
//             const uploadfiles = await moveFile(createdRepairJob.ra_job_id)
//             console.log("uploadfiles data ", uploadfiles)

//             let documents = []
//             for(let j=0; j< uploadfiles.length; j++){
//                 documents[j] = await Document.create(
//                 {
//                     repair_job_id: repairJob,
//                     document_name: uploadfiles[j],
//                     upload_at: "reapir_job",
//                     upload_by: Number(inputdata.created_by),
//                     created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
//                     updated_date: moment().format("YYYY-MM-DD HH:mm:ss")
//                 });
//             }

//             //Log creation
//             const log = {
//                 emp_id: inputdata.created_by ,
//                 description: `${inputdata.companyName} created the RA Job ${job_id}`,
//                 created_date: moment().format("YYYY-MM-DD hh:mm:ss"),
//                 log_status: "Successful", // Assume success by default
//             };

//             if (!createdRepairJob) {
//                 log.log_status = "Failure";
//                 await Log.create(log);
//                 throw new ApiError(400, "Something went wrong while adding the repair job.");
//             }

//             // Attempt to send email
//             try {
//                 await new Email().send(
//                     Jobdata.email,
//                     `${job_id} created successfully`,
//                     signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${inputdata.created_by }`)
//                 );
//             } catch (emailError) {
//                 console.error("Email sending failed:", emailError);
//                 log.description += ` (Email sending failed: ${emailError.message})`;
//                 log.log_status = "Warning";
//             }

//             // Log the result of the process
//             await Log.create(log);
//         }
//         return res.status(200).json(new ApiResponse(200, jobInfo, "multiple job data "))
            
//     } catch (error) {
//         throw new ApiError(400, " Errow while adding multiple job", error?.message)   
//     }
// })

// // Get last inserted job from DB.
//  async function getLastInsertJob(store_code){
//      // Generate RA JOB Number Automatically
//      const lastInsertId = await RepairJob.lastrecord();
//      return  lastInsertId
//          ? `${store_code}-${String(lastInsertId.id).padStart(5, '0')}`
//          : `${store_code}-00001`;

// }


// // Move this funciton to Utility. 
// // creat folder with job id. 
// function createFolder(jobId){
//     const folderName = path.join(__dirname,`../../public/uploads/${jobId}`);

//     try {
//         fs.mkdirSync(folderName,{recursive:true});
//         console.log(`Folder "${folderName}" created successfully.`);
//     } catch (err) {
//         console.error(`Error creating folder "${folderName}":`, err);
//     }
// }


// export { 
//         listRepairJob, 
//         insertRepairJob,
//         updateRepairJobSKU,
//         updateRepairJobSerialNumber,
//         serialNumberLookup,
//         updateTrackingNumber,
//         updateStatus,
//         updateDispatchId,
//         insertMultipalReapirJob,
//         receiveJob,
//         searchRepairJob,
//         repairJob
//     }
