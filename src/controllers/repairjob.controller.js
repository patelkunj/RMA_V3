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
