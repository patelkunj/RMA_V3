import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {RepairJobModel} from "../models/repairjob.model.js"
import {ProductModel} from "../models/product.model.js"
import {UserCustomerModel} from "../models/usercustomer.model.js"
import {UserOrganizationModel} from "../models/userorganization.model.js"
import { LogModel } from "../models/log.model.js"
import { RepairJobAuditLogModel } from "../models/repairjobauditlog.model.js"
//import {SerialNumberModel} from "../models/serialnumber.model.js"
import {ProductSerialsModel} from "../models/product_serials.model.js"
import moment from "moment"
import { Email } from "../utils/Email.js"
import {signupEmailTempate} from "../templates/signup.templates.js"
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { DocumentModel } from "../models/document.model.js"
import { overduedays, generateRandomString } from "../utils/common.js"
import { moveFile} from "../utils/fileUpload.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Class Object 
const RepairJob = new RepairJobModel();
const SerialNumber = new ProductSerialsModel()
const Product = new ProductModel();
const Log = new LogModel();
const Document = new DocumentModel();
const UserCustomer = new UserCustomerModel();
const UserOrganization = new UserOrganizationModel();   
const RepairJobAuditLog = new RepairJobAuditLogModel();


// for admin,
const listRepairJob = asyncHandler(async (req, res) => {
    try{

        const status = req.body.field || "created"


        let condition; 
        if(req.user){
            // User role
            //query = "job_status='" + field+"'  and customer_id in("+req.user.assigned_store_id+")"; 

            //get the assigned_customer_id
            //get the assigned_org_id



            //let assigned_customer_id = req.user.assigned_customer_id.split(",")
            //let assigned_org_id = req.user.assigned_org_id.split(",")

            let assigned_customer = await UserCustomer.selectFields(['customer_id']).find({'user_id':req.user.id}).execute();
            let assigned_org = await UserOrganization.selectFields(['organization_id']).find({'user_id':req.user.id}).execute();

            condition = {job_status:status, customer_id_in: assigned_customer, organization_id_in: assigned_org  }
        }else{
            // customer role
            //query = "job_status='" + field+"'  and customer_id='"+req.customer.id+"'"; 
            condition = {job_status:status,customer_id:req.customer.id, }
        }
        //const repairjob = await RepairJob.findByField(query)
        const repairjob = await RepairJob.find(condition).execute();
        if(!repairjob || repairjob.length == 0 ){
            return res.status(404).json(new ApiResponse(404, null, " No repair job found." ))
        }

        if( typeof repairjob === "object" ){
                repairjob.overDueDays = overduedays(repairjob.received_date),
                repairjob.received_date = moment(repairjob.received_date).format('DD-MM-YYYY'),
                repairjob.created_date =moment(repairjob.created_date).format('DD-MM-YYYY HH:mm:ss'),
                repairjob.updated_date =moment(repairjob.updated_date).format('DD-MM-YYYY HH:mm:ss')

        }else{
            const modifiedData = repairjob.map(job =>({
            ...job,
            overDueDays: overduedays(job.received_date),
            received_date:moment(job.received_date).format('DD-MM-YYYY'),
            created_date:moment(job.created_date).format('DD-MM-YYYY HH:mm:ss'),
            updated_date:moment(job.updated_date).format('DD-MM-YYYY HH:mm:ss'),
            }))

            return res.status(200).json(new ApiResponse(200, modifiedData, " List of repair job." ))

        }
        res.status(200).json(new ApiResponse(200, repairjob, " List of repair job." ))  
    }catch(error){
        throw new ApiError(400, "Error while listing the repair job ", error.message)
    }
})


const insertRepairJob = asyncHandler(async (req, res) => {
    try {
        // Extract data from request body

        //const data = JSON.parse(req.body.raJobData)

        const {
            organization_id,
            customer_id,
            company_customer_name,
            company_customer_mobile,
            store_code,
            email,
            company_job_no,
            sales_invoice,
            sku,
            product_name,
            serial_number,
            device_password,
            is_doa,
            is_product_under_warranty,
            //is_product_working,
            cloud_status,
            cloud_details,
            product_fault,
            video_url,
            customer_tracking_number,
        } = req.body;

        // Validation of data
        if ([sales_invoice, sku, product_name,serial_number, product_fault, customer_tracking_number]
            .some(field => !field?.trim())) {
            //throw new ApiError(400, "All fields are required");
            return res.status(400).json(new ApiError(400, " Please fill the required field information"))
        }

        // Generate RA JOB Number Automatically
        const lastInsertId = await RepairJob.lastrecord();
        let job_id;
        if(req.customer){
            job_id = lastInsertId
            ? `${req.customer?.store_code}-${String(lastInsertId.id).padStart(5, '0')}`
            : `${req.customer?.store_code}-00001`;
        }else{
            job_id = lastInsertId
            ? `${store_code}-${String(Number(lastInsertId.id) + 1 ).padStart(5, '0')}`
            : `${store_code}-00001`;
        }
        

        // Check if the job already exists
        //const existingJob = await RepairJob.findByField(`serial_number='${serial_number}' and job_status !='Dispatch'`);
        const existingJob = await RepairJob.find({serial_number, job_status_not: "Dispatch"}).execute();
        if (existingJob) {
            return res.status(400).json(new ApiError(400, "Repair job already exists"))
        }

        // Insert job into the database
        const repairjob = await RepairJob.create({
            ra_job_id: job_id,
            organization_id,
            customer_id: Number(customer_id),
            company_customer_name,
            company_customer_mobile,
            company_job_no : (company_job_no === 'undefine')?  null : company_job_no,
            sales_invoice : (sales_invoice === 'undefine') ? null : sales_invoice,
            sku,
            product_name,
            serial_number: (serial_number === 'undefine') ? null : serial_number ,
            device_password:  (device_password === 'undefine') ? null : device_password,
            is_doa:  Number(is_doa === "true"),
            is_product_under_warranty: Number(is_product_under_warranty === 'true'),
            //is_product_working: Number(is_product_working === 'true'),
            cloud_status: Number(cloud_status === 'true'),
            cloud_details : (cloud_details ==='undefine') ? null : cloud_details,
            product_fault : (product_fault === 'undefine') ? null  : product_fault,
            video_url : (video_url === 'undefine') ? null : video_url,
            customer_tracking_number : ( customer_tracking_number === 'undefine') ? null  : customer_tracking_number,
            created_by:  Number(req.user?.id) || Number(req.customer?.id),
            created_role_by: req.user?.role || "Customer",
            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            updated_date: moment().format("YYYY-MM-DD HH:mm:ss"),
        });

        console.log(" Repair job Controller :: Insert by custoemr :: repairjob ", repairjob);

        // Fetch the created repair job
        const createdRepairJob = await RepairJob.find({'id':repairjob}).execute();

        //create a folder with Job Number in Public/uploads Path: ../../public/uploads
        //const folderName = path.join(__dirname,`../../public/uploads/${createdRepairJob.ra_job_id}`);
        createFolder(createdRepairJob.id)

        // Move all the file  from temp to upload folder
        const uploadfiles = await moveFile(createdRepairJob.id,"repair_job")
        console.log("uploadfiles data ", uploadfiles)

        let documents = []
        let type='file';
        for(let j=0; j< uploadfiles.length; j++){

            if(uploadfiles[j].toString().includes("jpg") || uploadfiles[j].toString().includes("jpeg") || uploadfiles[j].toString().includes("png") || uploadfiles[j].toString().includes("webp")){
                type = 'image'
            }

            documents[j] = await Document.create({
                    repair_job_id: createdRepairJob.id,
                    related_type:"repair_job",
                    related_id: createdRepairJob.id,
                    document_name:uploadfiles[j].toString(),
                    document_url:`/uploads/${createdRepairJob.id}/repair_job/${uploadfiles[j].toString()}`, 
                    document_type: type||"file",
                    uploaded_by: req.user?.id || req.customer?.id,
                    uploaded_role: req.user?.role || req.customer?.role,
                    file_hash:generateRandomString(15), 
            })
        }

        //Log creation
        const log = {
            actor_id: req.customer?.id || req.user?.id ,
            actor_role :req.user?.user_role || "Customer",
            description: `${req.customer?.company_name || req.user?.first_name +' '+ req.user?.last_name} created the RA Job ${job_id}`,
            created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
            log_status: "Successful", // Assume success by default
        };

        if (!createdRepairJob) {
            log.log_status = "Failure";
            await Log.create(log);
            return res.status(400).json(new ApiError(400, " Something went wrong while adding the repair job."))
        }

        // Attempt to send email
        try {

            if(req.customer){
                await new Email().send(
                    req.customer?.email,
                    `${job_id} created successfully`,
                    signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${req.customer?.id}`)
                );
            }else{
                await new Email().send(
                    email,
                    `${job_id} created successfully`,
                    signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${req.customer?.id}`)
                );
            }
            
        } catch (emailError) {
            console.error("Email sending failed:", emailError);
            log.description += ` (Email sending failed: ${emailError.message})`;
            log.log_status = "Warning";
        }

        // Log the result of the process
        await Log.create(log);

        res.status(200).json(new ApiResponse(200, createdRepairJob, `RA Job ${job_id} created successfully and email sent`));

    } catch (error) {

        //delete temp folder the file.

        // Only throw an error if we haven't already sent a response
        if (!res.headersSent) {
            return res.status(400).json(new ApiError(400, "Internal Server Error", error.message))
        } else {
            console.error("Error occurred after response was sent:", error);
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

        // Find the SKU from Product Table 
        //const product = await Product.findByField("sku='"+sku+"'")
        const product = await Product.find({sku:sku}).execute();
        if(!product){
            return res.status(400).json( new ApiError(400," SKU didn't found in the product list."));
        }

        let product_name = product.name 
        product_name += (product.model)? "- "+product.model : ""
        product_name += (product.color) ? "- "+product.color :""

        //Log creation
        const log = {
            repair_job_id: id,
            action_type: "Update",
            description: `Updated  SKU to ${sku}`,
            performed_by : req.user?.id,
            performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        const newSKU = await RepairJob.update({'id':id},{sku,product_name: product_name,updated_date : moment().format("YYYY-MM-DD HH:mm:ss") })
        if(!newSKU){

           return res.status(400).json(new ApiError(400," Error while updating the SKU in repair job."))
        }
         // Log the result of the process
        RepairJobAuditLog.create(log);
        returnres.status(200).json(new ApiResponse(200, newSKU, "SKU Update Successfully."))

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

        // Find the Serial number from serial number Table 
        //const serialNumber = await SerialNumber.findByField("serial_number='"+serial_number+"'")
        //const serialNumber = await SerialNumber.find({'serial_number':serial_number}).execute();
        const serialNumber = await SerialNumber.find({'serial_number':serial_number}).join("products","product_serials.product_id = products.id ","left").execute();

        if(!serialNumber){
            returnres.status(400).json( new ApiError(404," Serial Number didn't found in the Serial Number list."))
        }
        
        const log = {
            repair_job_id: id,
            action_type: "Update",
            description: `Updated serial number to ${serialNumber.serial_number}`,
            performed_by : req.user?.id,
            performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        const data = await RepairJob.update({'id':id},{sku: serialNumber.sku, product_name: serialNumber.name , serial_number: serialNumber.serial_number , sales_invoice: serialNumber.sales_invoice, updated_date : moment().format("YYYY-MM-DD HH:mm:ss") })
        if(!data){
            return res.status(400).json(new ApiError(400, " Error while updating the serial number"))
        }

        // log creation
        RepairJobAuditLog.create(log);
        returnres.status(200).json(new ApiResponse(200, data, " Serial Number update successfully."))
        
    } catch (error) {
        returnres.status(400).json(new ApiError(400," Error in Update Repair Job Serial Number"))
    }
})


const serialNumberLookup = asyncHandler(async (req, res) => {
    try {
        
        const {serial_number} = req.body
        // Validation of data
        if (serial_number == "" || serial_number == undefined ) {
            returnres.status(400).json(new ApiError(400, "serial number is required"));
        }

        const serialNumber = await SerialNumber.find({'serial_number':serial_number}).join("products","product_serials.product_id = products.id ","left").execute();
        
        if(!serialNumber){
           return res.status(400).json( new ApiError(400, " serial number is not found."))
        }

        return res.status(200).json(new ApiResponse(200, serialNumber, " Serial Number found successfully"))

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

        //Log creation
        const log = {
            repair_job_id: id,
            action_type: "Update",
            description: `Updated  Tracking Number to ${tracking_number}`,
            performed_by : req.user?.id,
            performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        const repairjob = await RepairJob.update({'id':id},{customer_tracking_number:tracking_number})
        if(!repairjob){
            return res.status(400).json( new ApiError(400, " Tracking Number isn't updated successfaully."))
        }

         // Log the result of the process
        RepairJobAuditLog.create(log);
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

        //Log creation
        const log = {
            repair_job_id: id,
            action_type: "Update",
            description: `Updated  Status to ${status}`,
            performed_by : req.user?.id,
            performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        const repairjob = await RepairJob.update({'id':id},{job_status:status})
        if(!repairjob){
            return res.status(400).json(new ApiError(400, " Status isn't updated successfaully."))
        }
 
        RepairJobAuditLog.create(log);
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

        //Log creation
        const log = {
            repair_job_id: id,
            action_type: "Update",
            description: `Updated  Dispatch ID to ${dispatchId}`,
            performed_by : req.user?.id,
            performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        const repairjob = await RepairJob.update({'id':id},{dispatch_id:dispatchId, job_status:"completed", completion_date: moment().format("YYYY-MM-DD HH:mm:ss") })
        if(!repairjob){
            return res.status(400).json(new ApiError(400, " Dispatch ID  isn't updated successfaully."));
        }

        RepairJobAuditLog.create(log);
        res.status(200).json(new ApiResponse(200, repairjob, " Dispatch ID updated successfaully."))

    } catch (error) {
        returnres.status(400).json(new ApiError(400, "Error while updating Dispatch ID"))
    }
})


const receiveJob = asyncHandler(async (req, res) => {
    try {
        
        const {id,tracking_number } = req.body
        // Validation of data
        if (!tracking_number) {
            res.status(400).json(new ApiError(400, " Tracking number is required"));
        }

        //Log creation
        const log = {
            repair_job_id: id,
            action_type: "Update",
            description: `Receievd Job with Tracking Number - ${tracking_number}`,
            performed_by : req.user?.id,
            performed_at : moment().format("YYYY-MM-DD HH:mm:ss"),
        };

        const repairjob = await RepairJob.update({'id':id},{
                customer_tracking_number:tracking_number,
                job_status:"Received",
                received_by: Number(req.user?.id),
                received_role_by: req.user?.role,
                received_date:moment().format("YYYY-MM-DD HH:mm:ss")
            })

        
        if(!repairjob){
            res.status(400).json(new ApiError(400, " Job is not received successfaully."));
        }

        RepairJobAuditLog.create(log);
        const updateJob = await RepairJob.find({id}).execute();
        res.status(200).json(new ApiResponse(200, updateJob, " Job is received successfaully."))

    } catch (error) {
        res.status(400).json(new ApiError(400, "Error while receiving job in system."))
    }
})


const repairJob = asyncHandler(async (req, res) => {
    try { 
        const {id} = req.body
        if (!id) {
            throw new ApiError(400, "fields is required");
        }
        const repairjob = await RepairJob.find({id}).execute();
        
         if(!repairjob){
            throw new ApiError(400, " Job is not received successfaully.")
        }

        repairjob.overDueDays = overduedays(repairjob.received_date)

        res.status(200).json(new ApiResponse(200, repairjob, " Job is received successfaully."))

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

        const repairjob = await RepairJob.search(searchData)
        if(!repairjob){
            throw new ApiError(400, " No Job found.")
        }

        res.status(200).json(new ApiResponse(200, repairjob, " Job is found successfaully."))

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

        let repairJob, length, job_id;
        let jobInfo=[];
    
        if(typeof Jobdata.data === "string"){
            length=1;
        }else{
            length = Jobdata.data.length;
        }

        for(let i=0; i< length; i++){

            job_id = await getLastInsertJob(req.customer?.store_code)

            let inputdata = (length==1) ? JSON.parse(Jobdata.data) : JSON.parse(Jobdata.data[i])

            // Check if the job already exists
            //const existingJob = await RepairJob.findByField(`serial_number='${inputdata.serial_number}' and job_status !='Dispatch'`);
            const existingJob = await RepairJob.find({
                serial_number: inputdata.serial_number,
                job_status_not: "Dispatch"
            }).execute();
            if (existingJob) {
                throw new ApiError(400, "Repair job already exists");
            }

            repairJob = await RepairJob.create({
                ra_job_id: job_id,
                customer_id: Number(Jobdata.Customer_id),
                company_customer_name: Jobdata.companyName,
                company_customer_mobile: Jobdata.phone,
                company_job_no:Jobdata.company_job_no,
                sales_invoice: inputdata.sales_invoice,
                sku: inputdata.sku,
                product_name: inputdata.product_name,
                serial_number: inputdata.serial_number,
                device_password:inputdata.device_password,
                is_doa: inputdata.is_doa,
                is_product_under_waranty: inputdata.is_product_under_waranty,
                is_product_working: inputdata.is_product_working,
                cloud_status: inputdata.cloud_status,
                cloud_details: inputdata.cloud_details || null,
                product_fault: inputdata.product_fault,
                video_url: inputdata.video_url || null,
                customer_tracking_number: inputdata.customer_tracking_number || null,
                job_status: inputdata.job_status,
                created_by: Number(inputdata.created_by),
                created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                updated_date: moment().format("YYYY-MM-DD HH:mm:ss")
            });

            console.log(" Repair job Controller :: Insert by custoemr :: repairjob ", repairJob);

            // Fetch the created repair job
            const createdRepairJob = await RepairJob.findById(repairJob);
            jobInfo.push(createdRepairJob);

            //create a folder with Job Number in Public/uploads Path: ../../public/uploads
            //const folderName = path.join(__dirname,`../../public/uploads/${createdRepairJob.ra_job_id}`);
            createFolder(createdRepairJob.ra_job_id)

            // Move all the file  from temp to upload folder
            const uploadfiles = await moveFile(createdRepairJob.ra_job_id)
            console.log("uploadfiles data ", uploadfiles)

            let documents = []
            for(let j=0; j< uploadfiles.length; j++){
                documents[j] = await Document.create(
                {
                    repair_job_id: repairJob,
                    document_name: uploadfiles[j],
                    upload_at: "reapir_job",
                    upload_by: Number(inputdata.created_by),
                    created_date: moment().format("YYYY-MM-DD HH:mm:ss"),
                    updated_date: moment().format("YYYY-MM-DD HH:mm:ss")
                });
            }

            //Log creation
            const log = {
                emp_id: inputdata.created_by ,
                description: `${inputdata.companyName} created the RA Job ${job_id}`,
                created_date: moment().format("YYYY-MM-DD hh:mm:ss"),
                log_status: "Successful", // Assume success by default
            };

            if (!createdRepairJob) {
                log.log_status = "Failure";
                await Log.create(log);
                throw new ApiError(400, "Something went wrong while adding the repair job.");
            }

            // Attempt to send email
            try {
                await new Email().send(
                    Jobdata.email,
                    `${job_id} created successfully`,
                    signupEmailTempate(`http://localhost:3000/api/v1/users/activeuser/${inputdata.created_by }`)
                );
            } catch (emailError) {
                console.error("Email sending failed:", emailError);
                log.description += ` (Email sending failed: ${emailError.message})`;
                log.log_status = "Warning";
            }

            // Log the result of the process
            await Log.create(log);
        }
        return res.status(200).json(new ApiResponse(200, jobInfo, "multiple job data "))
            
    } catch (error) {
        throw new ApiError(400, " Errow while adding multiple job", error?.message)   
    }
})

// Get last inserted job from DB.
 async function getLastInsertJob(store_code){
     // Generate RA JOB Number Automatically
     const lastInsertId = await RepairJob.lastrecord();
     return  lastInsertId
         ? `${store_code}-${String(lastInsertId.id).padStart(5, '0')}`
         : `${store_code}-00001`;

}


// Move this funciton to Utility. 
// creat folder with job id. 
function createFolder(jobId){
    const folderName = path.join(__dirname,`../../public/uploads/${jobId}`);

    try {
        fs.mkdirSync(folderName,{recursive:true});
        console.log(`Folder "${folderName}" created successfully.`);
    } catch (err) {
        console.error(`Error creating folder "${folderName}":`, err);
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
