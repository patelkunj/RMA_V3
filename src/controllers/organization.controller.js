import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import prisma from "../db/prisma.js";
import {
    ensureUserCanAccessOrganization,
    getAssignedOrganizationIds,
    isSuperAdmin,
} from "../utils/accessControl.js";


// add pagination
const listOrganization = asyncHandler(async (req, res) => {

    try {
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
        const skip = (page - 1) * limit;

        const organizationIds = isSuperAdmin(req.user)
            ? []
            : await getAssignedOrganizationIds(req.user);

        const where = isSuperAdmin(req.user)
            ? {}
            : { id: { in: organizationIds } };

        const [org, total] = await Promise.all([
            prisma.organization.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: "asc" },
            }),
            prisma.organization.count({ where }),
        ]);

        return res.status(200).json(
            new ApiResponse(200, {
                organizations: org,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            }, "List of all organizations")
        );

    } catch (error) {
        res.status(400).json(new ApiError(400, "Error while listing organization", error?.message ))
    }
});

const creatOrganization = asyncHandler(async (req, res) => {

    try {
        const { name, alias, address, email, phone, isActive } = req.body;

        if (!name || !alias) {
            throw new ApiError(400, "Name and alias are required");
        }

        const org = await prisma.organization.create({
            data: {
                name,
                alias,
                address,
                email,
                phone,
                isActive: Boolean(isActive)
            }
        });

        return res.status(201).json(
            new ApiResponse(201, org, "Organization created successfully")
        );
    } catch (error) {
        res.status(400).json(new ApiError(400, "Error while creating organization.", error?.message ))
    }


    
});


const updateOrganization = asyncHandler(async (req, res) => {

    try {
        const { id, name, alias, address, email, phone } = req.body;

        if (!id) {
            throw new ApiError(400, "ID is required");
        }

        await ensureUserCanAccessOrganization(req.user, id);

        const org = await prisma.organization.update({
            where: { id: Number(id) },
            data: {
                name,
                alias,
                address,
                email,
                phone
            }
        });

        return res.status(200).json(
            new ApiResponse(200, org, "Organization updated successfully")
        );
    } catch (error) {
        res.status(400).json(new ApiError(400, "Error while updating organization.", error?.message ))
    }

    
});


const toggleStatus = asyncHandler(async (req, res) => {

    try {
        const { id} = req.body;

        if (!id) {
            throw new ApiError(400, "ID is required");
        }

        const orgData = await prisma.organization.findUnique({
            where:{id:Number(id)}
        })

        if(!orgData){
            return res.status(404).json(new ApiError(404, "Organization not found"));
        }

        const org = await prisma.organization.update({
            where:{id:Number(id)},
            data:{isActive:Boolean(!orgData.isActive)}
        });

        return res.status(200).json(
            new ApiResponse(200, org, "Status updated successfully")
        );
    } catch (error) {
        res.status(400).json(new ApiError(400, "Error while changing status of organization. ", error?.message ))
    }
});


const getOrganizationDetail = asyncHandler(async (req, res)=> {

    try {
        const {id} = req.params;

        if(!id){
            return res.status(400).json(new ApiError(400, " organization data not found"))
        }

        await ensureUserCanAccessOrganization(req.user, id);

        const orgData = await prisma.organization.findUnique({
            where:{id:Number(id)}
        })

        if(!orgData){
            return res.status(200).json(new ApiResponse(200, null, " Organization detail not found."))
        }
        return res.status(200).json(new ApiResponse(200, orgData, "Organization data found."));

    } catch (error) {
        res.status(400).json(new ApiError(400, "Error while getting detail of organization. ", error?.message ))
    }


})


// const searchCompany = asyncHandler(async(req,res)=>{
//     try {
//         const searchTerm = req.body

//         if(!searchTerm){
//             throw new ApiError(400, " search in empty.")
//         }

//         const org = await Organization.search(searchTerm)

//         if(!org){
//             res.status(404).json(new ApiResponse(404, null, " No company found"))
//         }

//         res.status(200).json(new ApiResponse(200, org, " company found"))

//     } catch (error) {
//         throw new ApiError(400, " Error in seach company")
//     }
// })


// const allCompany = asyncHandler(async(req,res)=>{
//     try {
//         const org = await Organization.find()
//         if(!org){
//             res.status(404).json(new ApiResponse(404, null, " No company found"))
//         }
//         res.status(200).json(new ApiResponse(200, org, " company found"))
        
//     } catch (error) {
//         throw new ApiError(400," Error in all company list")   
//     }
// })

export {
    listOrganization,
    creatOrganization,
    updateOrganization,
    toggleStatus,
    getOrganizationDetail
    // searchCompany,
    // allCompany
}
