import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import xlsx from 'xlsx';
import fs from 'fs';
import prisma from "../db/prisma.js"
import {
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    isSuperAdmin,
} from "../utils/accessControl.js";

const parseDate = (value, fieldName) => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
        throw new ApiError(400, `${fieldName} must be a valid date.`);
    }
    return date;
};

const ensureProductBelongsToOrganization = async (productId, organizationId) => {
    const product = await prisma.product.findFirst({
        where: {
            id: Number(productId),
            organizationId: Number(organizationId),
        },
        select: { id: true },
    });

    if (!product) {
        throw new ApiError(400, "Product does not belong to the selected organization.");
    }
};
 
 
const listSerialNumber = asyncHandler(async(req,res) => {
    // Select with pagination.
    try {
        const page = Math.max(Number(req.query.page || req.body?.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit || req.body?.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const where = isSuperAdmin(req.user)
            ? {}
            : { organizationId: { in: organizationIds } };
 
        const [list, total] = await Promise.all([
            prisma.productSerial.findMany({
                where,
                skip,
                take: limit,
                include: {
                    product: { select: { id: true, sku: true, name: true } },
                },
                orderBy: { id: "desc" },
            }),
            prisma.productSerial.count({ where }),
        ]);
 
        return res.status(200).json(new ApiResponse(200, {
            serialNumbers: list,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        }, " List of SerialNumbers"))
 
    } catch (error) {
        throw new ApiError(400, " Error while listing serialnumber", error?.message)
    }
})
 
const updateSerialNumber = asyncHandler(async(req,res) => {
    // update with field value.
    try {
 
        const {
            id,
            organization_id,
            product_id,
            serial_number,
            sales_order,
            sales_date,
            warranty_expriy,
            is_replacement,
        } = req.body
 
         // validation of data
        if([id, organization_id, product_id, serial_number,sales_order, sales_date, warranty_expriy].some((field) => String(field ?? "").trim() === "")){
            return res.status(400).json(new ApiError(400, "All field are required"))
        }

        await ensureUserCanAccessOrganization(req.user, organization_id);
        await ensureProductBelongsToOrganization(product_id, organization_id);
 
        const data = await prisma.productSerial.update({
            where: { id: Number(id) },
            data: {
                organizationId: Number(organization_id),
                productId: Number(product_id),
                serialNumber: serial_number,
                salesInvoice: sales_order, // mapped — see conversion notes #1
                saleDate: parseDate(sales_date, "sales_date"),
                warrantyExpiry: parseDate(warranty_expriy, "warranty_expriy"),
                isReplacementProduct: is_replacement !== undefined ? (is_replacement === true || is_replacement === 'true') : undefined,
            },
        });
 
        if(!data){
            return res.status(400).json(new ApiError(400," Error while updateing serialnumber data"))
        }
 
        res.status(200).json(new ApiResponse(200,data,"Update the serial number successfully."))
 
    } catch (error) {
        return res.status(400).json(new ApiError(400, " Error while updating serialnumber." ,error?.message))
    }
})
 
const insertSerialNumber = asyncHandler(async(req,res) => {
    // update with field value.
    try {
        const {
            organization_id,
            product_id,
            serial_number,
            sales_order,
            sales_date,
            warranty_expriy,
            is_replacement,
        } = req.body
 
        // validation of data
        if([organization_id, product_id, serial_number,sales_order, sales_date, warranty_expriy].some((field) => String(field ?? "").trim() === "")){
            return res.status(400).json(new ApiError(400, "All field are required"))
        }

        await ensureUserCanAccessOrganization(req.user, organization_id);
        await ensureProductBelongsToOrganization(product_id, organization_id);
 
        // serialNumber is @unique, so findUnique is the correct lookup here.
        const existingSerialNumber = await prisma.productSerial.findUnique({
            where: { serialNumber: serial_number },
        });
        if(existingSerialNumber){
            // NOTE: condition fixed — see conversion notes #2
            return res.status(400).json(new ApiResponse(400,existingSerialNumber, "Serial number is alreadt exisit."))
        }
 
        const data = await prisma.productSerial.create({
            data: {
                organizationId: Number(organization_id),
                productId: Number(product_id),
                serialNumber: serial_number,
                salesInvoice: sales_order, // mapped — see conversion notes #1
                saleDate: parseDate(sales_date, "sales_date"),
                warrantyExpiry: parseDate(warranty_expriy, "warranty_expriy"),
                isReplacementProduct: is_replacement === true || is_replacement === 'true',
            },
        });
 
        if(!data){
            return res.status(400).json(new ApiError(400," Error while inserting serialnumber data"))
        }
 
        return res.status(200).json(new ApiResponse(200, data, "insert serial umber recored successfully."))
 
    } catch (error) {
        return res.status(400).json(new ApiError(400, " Error while inserting serialnumber." ,error?.message))
    }
})
 
// NOTE: this still only parses the uploaded Excel file and returns the JSON —
// it does not persist anything to the database (see conversion notes #5).
const uploadSerialNumber = asyncHandler(async(req,res) => {
    // upload serial number from excel file.
    try {
        if (!req.file?.path) {
            return res.status(400).json(new ApiError(400, "Excel file is required."));
        }

        const filePath = req.file.path;
 
        // Read the Excel file
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = xlsx.utils.sheet_to_json(sheet);
 
        // Clean up uploaded file
        fs.unlinkSync(filePath);

        return res.status(200).json(new ApiResponse(200, jsonData, " Excel File Data " ));

    } catch (error) {
        return res.status(400).json(new ApiError(400, " Error while uploading serialnumber." ,error?.message))
    }
})
 
 
export{
    insertSerialNumber,
    listSerialNumber,
    updateSerialNumber,
    uploadSerialNumber
}



// import {ApiError} from "../utils/ApiError.js"
// import {ApiResponse} from "../utils/ApiResponse.js"
// import {asyncHandler} from "../utils/asyncHandler.js"
// //import { SerialNumberModel } from "../models/serialnumber.model.js"
// import {ProductSerialsModel} from "../models/product_serials.model.js"
// import moment from "moment"
// //import {xlsx} from 'xlsx';
// //import {path} from 'path';


// const SerialNumber = new ProductSerialsModel()


// const listSerialNumber = asyncHandler(async(req,res) => {
//     // Select with pagination.
//     try { 

//         //const list = await SerialNumber.find().execute();

//         const list = await SerialNumber.find().join('products','product_id = products.id',{type: "left", alias: "p",select: ["id"]}).execute();

//         if(!list || list.length == 0 ){
//             return res.status(404).json(new ApiResponse(404, null, " No Data Found." ))
//         }
//         const modifiedData = list.map(number =>({
//             ...number,
//             dispatch_date:moment(number.dispatch_date).format('DD-MM-YYYY HH:mm:ss a'),
//         }))

//         return res.status(200).json(new ApiResponse(200, modifiedData, " List of SerialNumbers"))

//     } catch (error) {
//         throw new ApiError(400, " Error while listing serialnumber", error?.message)
//     }
// })

// const updateSerialNumber = asyncHandler(async(req,res) => {
//     // update with field value.
//     try {
        
//         const {
//             id,
//             organization_id,
//             product_id,
//             serial_number,
//             sales_order,
//             sales_date,
//             warranty_expriy,
//             is_replacement,
//         } = req.body

//          // validation of data
//         if([serial_number,sales_order].some((field) => field?.trim() === "")){
//             return res.status(400).json(new ApiError(400, "All field are required"))        
//         }


//         const data = await SerialNumber.update({'id':id},{
//             organization_id,
//             product_id,
//             serial_number,
//             sales_order,
//             sales_date,
//             warranty_expriy,
//             is_replacement,
//             updated_date : moment().format("YYYY-MM-DD HH:mm:ss")
//         })

//         if(!data){
//             return res.status(400).json(new ApiError(400," Error while updateing serialnumber data"))
//         }

//         res.status(200).json(new ApiResponse(200,data,"Update the serial number successfully."))

//     } catch (error) {
//         return res.status(400).json(new ApiError(400, " Error while updating serialnumber." ,error?.message))
//     }
// })

// const insertSerialNumber = asyncHandler(async(req,res) => {
//     // update with field value.
//     try {
//         // sku, product_name, serial_number, sales_order DB Data. 
//         //const {sku,product_name,serial_number,sales_order } = req.body
//         const {
//             organization_id,
//             product_id,
//             serial_number,
//             sales_order,
//             sales_date,
//             warranty_expriy,
//             is_replacement,
//         } = req.body


//         // validation of data
//         if([serial_number,sales_order].some((field) => field?.trim() === "")){
//             return res.status(400).json(new ApiError(400, "All field are required"))        
//         }

//         const existingSerialNumber = await SerialNumber.find({"serial_number":serial_number}).execute();
//         if(!existingSerialNumber){
//             return res.status(400).json(new ApiResponse(400,existingSerialNumber, "Serial number is alreadt exisit."))
//         }

//         const data = await SerialNumber.create({
//             organization_id,
//             product_id,
//             serial_number,
//             sales_order,
//             sales_date,
//             warranty_expriy,
//             is_replacement,
//         })

//         if(!data){
//             return res.status(400).json(new ApiError(400," Error while inserting serialnumber data"))
//         }

//         return res.status(200).json(new ApiResponse(200, data, "insert serial umber recored successfully."))

//     } catch (error) {
//         return res.status(400).json(new ApiError(400, " Error while inserting serialnumber." ,error?.message))
//     }
// })

// // TODO: Need to check the Function. 
// const uploadSerialNumber = asyncHandler(async(req,res) => {
//     // upload serial number from excel file.
//     try {
//         const filePath = req.file.path;

//         // Read the Excel file
//         const workbook = xlsx.readFile(filePath);
//         const sheetName = workbook.SheetNames[0];
//         const sheet = workbook.Sheets[sheetName];
//         const jsonData = xlsx.utils.sheet_to_json(sheet);

//         // Clean up uploaded file
//         fs.unlinkSync(filePath);

//         return res.status(200).json(new ApiResponse(200, jsonData, " Excel File Data " ));

//     } catch (error) {
//         throw new ApiError(400, " Error while updateing serialnumber." ,error?.message)
//     }
// })


// export{
//     insertSerialNumber,
//     listSerialNumber,
//     updateSerialNumber,
//     uploadSerialNumber
// }
