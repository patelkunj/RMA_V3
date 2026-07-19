import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import ExcelJS from "exceljs";
import fs from 'fs';
import prisma from "../db/prisma.js"
import { respondWithSafeError, safeServiceError } from "../utils/safeError.js";
import { paginatedData } from "../utils/pagination.js";
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

const cellValue = (value) => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value;
    if (typeof value === "object") {
        if ("result" in value) return value.result;
        if ("text" in value) return value.text;
        if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join("");
    }
    return value;
};

const worksheetRows = (worksheet) => {
    const headers = worksheet.getRow(1).values.slice(1).map((value) => String(cellValue(value)).trim());
    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const record = {};
        headers.forEach((header, index) => { if (header) record[header] = cellValue(row.getCell(index + 1).value); });
        if (Object.values(record).some((value) => value !== "")) rows.push(record);
    });
    return rows;
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

        return res.status(200).json(new ApiResponse(
            200,
            paginatedData(list, { total, page, limit }, "serialNumbers"),
            "Serial numbers fetched successfully.",
        ))

    } catch (error) {
        throw safeServiceError(error, "serial-number.list", "Unable to list serial numbers.");
    }
})

const updateSerialNumber = asyncHandler(async(req,res) => {
    // update with field value.
    try {

        const id = req.params.id ?? req.body?.id;
        const organizationId = req.body.organizationId ?? req.body.organization_id;
        const productId = req.body.productId ?? req.body.product_id;
        const serialNumber = req.body.serialNumber ?? req.body.serial_number;
        const salesInvoice = req.body.salesInvoice ?? req.body.salesOrder ?? req.body.sales_order;
        const saleDate = req.body.saleDate ?? req.body.salesDate ?? req.body.sales_date;
        const warrantyExpiry = req.body.warrantyExpiry ?? req.body.warranty_expriy;
        const isReplacementProduct = req.body.isReplacementProduct ?? req.body.isReplacement ?? req.body.is_replacement;

         // validation of data
        if([id, organizationId, productId, serialNumber, salesInvoice, saleDate, warrantyExpiry].some((field) => String(field ?? "").trim() === "")){
            return res.status(400).json(new ApiError(400, "All field are required"))
        }

        const assignedOrganizationIds = isSuperAdmin(req.user) ? [] : await getAssignedOrganizationIds(req.user);
        const existingSerial = await prisma.productSerial.findFirst({
            where: {
                id: Number(id),
                ...(isSuperAdmin(req.user) ? {} : { organizationId: { in: assignedOrganizationIds } }),
            },
            select: { id: true, organizationId: true },
        });
        if (!existingSerial) throw new ApiError(404, "Serial number not found.");
        if (!isSuperAdmin(req.user) && existingSerial.organizationId !== Number(organizationId)) {
            throw new ApiError(403, "Only super administrators can move a serial number between organizations.");
        }

        await ensureUserCanAccessOrganization(req.user, organizationId);
        await ensureProductBelongsToOrganization(productId, organizationId);
        const duplicate = await prisma.productSerial.findUnique({
            where: { serialNumber },
            select: { id: true },
        });
        if (duplicate && duplicate.id !== existingSerial.id) {
            throw new ApiError(409, "Serial number already exists.");
        }

        const data = await prisma.productSerial.update({
            where: { id: existingSerial.id, organizationId: existingSerial.organizationId },
            data: {
                organizationId: Number(organizationId),
                productId: Number(productId),
                serialNumber,
                salesInvoice,
                saleDate: parseDate(saleDate, "saleDate"),
                warrantyExpiry: parseDate(warrantyExpiry, "warrantyExpiry"),
                isReplacementProduct: isReplacementProduct !== undefined ? (isReplacementProduct === true || isReplacementProduct === 'true') : undefined,
            },
        });

        return res.status(200).json(new ApiResponse(200, data, "Serial number updated successfully."))

    } catch (error) {
        return respondWithSafeError(res, error, "serial-number.update", "Unable to update serial number.");
    }
})

const insertSerialNumber = asyncHandler(async(req,res) => {
    // update with field value.
    try {
        const organizationId = req.body.organizationId ?? req.body.organization_id;
        const productId = req.body.productId ?? req.body.product_id;
        const serialNumber = req.body.serialNumber ?? req.body.serial_number;
        const salesInvoice = req.body.salesInvoice ?? req.body.salesOrder ?? req.body.sales_order;
        const saleDate = req.body.saleDate ?? req.body.salesDate ?? req.body.sales_date;
        const warrantyExpiry = req.body.warrantyExpiry ?? req.body.warranty_expriy;
        const isReplacementProduct = req.body.isReplacementProduct ?? req.body.isReplacement ?? req.body.is_replacement;

        // validation of data
        if([organizationId, productId, serialNumber, salesInvoice, saleDate, warrantyExpiry].some((field) => String(field ?? "").trim() === "")){
            return res.status(400).json(new ApiError(400, "All field are required"))
        }

        await ensureUserCanAccessOrganization(req.user, organizationId);
        await ensureProductBelongsToOrganization(productId, organizationId);

        // serialNumber is @unique, so findUnique is the correct lookup here.
        const existingSerialNumber = await prisma.productSerial.findUnique({
            where: { serialNumber },
        });
        if(existingSerialNumber){
            return res.status(409).json(new ApiError(409, "Serial number already exists."))
        }

        const data = await prisma.productSerial.create({
            data: {
                organizationId: Number(organizationId),
                productId: Number(productId),
                serialNumber,
                salesInvoice,
                saleDate: parseDate(saleDate, "saleDate"),
                warrantyExpiry: parseDate(warrantyExpiry, "warrantyExpiry"),
                isReplacementProduct: isReplacementProduct === true || isReplacementProduct === 'true',
            },
        });

        if(!data){
            return res.status(400).json(new ApiError(400," Error while inserting serialnumber data"))
        }

        return res.status(201).json(new ApiResponse(201, data, "Serial number created successfully."))

    } catch (error) {
        return respondWithSafeError(res, error, "serial-number.insert", "Unable to insert serial number.");
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
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(filePath);
        const sheet = workbook.worksheets[0];
        if (!sheet) throw new ApiError(400, "Workbook does not contain a worksheet.");
        const jsonData = worksheetRows(sheet);
        const organizationId = Number(req.body.organizationId || req.body.organization_id);
        if (!organizationId) throw new ApiError(400, "organizationId is required.");
        await ensureUserCanAccessOrganization(req.user, organizationId);

        const products = await prisma.product.findMany({
            where: { organizationId },
            select: { id: true, sku: true },
        });
        const productsBySku = new Map(products.map((product) => [product.sku.toLowerCase(), product.id]));
        const existingSerials = new Set((await prisma.productSerial.findMany({ select: { serialNumber: true } })).map((row) => row.serialNumber));
        const rows = [];
        const errors = [];

        jsonData.forEach((raw, index) => {
            const normalized = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key.trim().toLowerCase().replaceAll(" ", "_"), value]));
            const serialNumber = String(normalized.serial_number || normalized.serialnumber || "").trim();
            const sku = String(normalized.sku || "").trim();
            const productId = productsBySku.get(sku.toLowerCase());
            const saleDate = new Date(normalized.sale_date || normalized.sales_date);
            const warrantyExpiry = new Date(normalized.warranty_expiry || normalized.warranty_expriy);
            const rowErrors = [];
            if (!serialNumber) rowErrors.push("serial_number is required");
            if (!productId) rowErrors.push("sku does not exist in this organization");
            if (Number.isNaN(saleDate.getTime())) rowErrors.push("sale_date is invalid");
            if (Number.isNaN(warrantyExpiry.getTime())) rowErrors.push("warranty_expiry is invalid");
            if (existingSerials.has(serialNumber)) rowErrors.push("serial_number already exists");
            if (rowErrors.length) {
                errors.push({ row: index + 2, errors: rowErrors });
                return;
            }
            existingSerials.add(serialNumber);
            rows.push({
                organizationId,
                productId,
                serialNumber,
                salesInvoice: String(normalized.sales_invoice || normalized.sales_order || "").trim(),
                saleDate,
                warrantyExpiry,
                isReplacementProduct: [true, "true", "yes", 1, "1"].includes(normalized.is_replacement),
            });
        });

        const commit = req.body.commit === true || req.body.commit === "true";
        if (commit && errors.length && req.body.allowPartial !== "true") {
            throw new ApiError(422, "Import contains invalid rows. Correct them or explicitly enable allowPartial.", errors);
        }
        const imported = commit && rows.length
            ? await prisma.productSerial.createMany({ data: rows, skipDuplicates: true })
            : { count: 0 };

        return res.status(200).json(new ApiResponse(200, {
            preview: !commit,
            totalRows: jsonData.length,
            validRows: rows.length,
            invalidRows: errors.length,
            importedRows: imported.count,
            errors,
        }, commit ? "Serial numbers imported successfully." : "Serial number import preview generated."));

    } catch (error) {
        if (error instanceof ApiError) return res.status(error.statusCode).json(error);
        return respondWithSafeError(res, error, "serial-number.upload", "Unable to upload serial numbers.");
    } finally {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
})


export{
    insertSerialNumber,
    listSerialNumber,
    updateSerialNumber,
    uploadSerialNumber
}
